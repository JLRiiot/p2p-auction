"use strict";

import RPC from "@hyperswarm/rpc";
import DHT from "hyperdht";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import crypto from "crypto";

const main = async ({ clientName }) => {
  // hyperbee db
  const hcore = new Hypercore(`./db/rpc-server/${clientName}`);
  const hbee = new Hyperbee(hcore, {
    keyEncoding: "utf-8",
    valueEncoding: "binary",
  });
  await hbee.ready();

  // resolved distributed hash table seed for key pair
  let dhtSeed = (await hbee.get("dht-seed"))?.value;
  if (!dhtSeed) {
    // not found, generate and store in db
    dhtSeed = crypto.randomBytes(32);
    await hbee.put("dht-seed", dhtSeed);
  }

  // start distributed hash table, it is used for rpc service discovery
  const dht = new DHT({
    port: 40001,
    keyPair: DHT.keyPair(dhtSeed),
    bootstrap: [{ host: "127.0.0.1", port: 30001 }], // note boostrap points to dht that is started via cli
  });

  // @TODO: this should add the other peers to a db so that we can connect to them later
  dht.on("connection", (...args) => {
    console.log("connected to peer:");
    console.log(args);
  });

  await dht.ready();

  // resolve rpc server seed for key pair
  let rpcSeed = (await hbee.get("rpc-seed"))?.value;
  if (!rpcSeed) {
    rpcSeed = crypto.randomBytes(32);
    await hbee.put("rpc-seed", rpcSeed);
  }

  // setup rpc server
  const rpc = new RPC({ seed: rpcSeed, dht });
  const rpcServer = rpc.createServer();
  await rpcServer.listen();
  console.log(
    `${clientName} Server listening on pubKey:\n`,
    rpcServer.publicKey.toString("hex")
  );

  // bind handlers to rpc server
  rpcServer.respond("ping", async (reqRaw) => {
    // reqRaw is Buffer, we need to parse it
    const req = JSON.parse(reqRaw.toString("utf-8"));

    const resp = { nonce: req.nonce + 1 };

    // we also need to return buffer response
    const respRaw = Buffer.from(JSON.stringify(resp), "utf-8");
    return respRaw;
  });

  // closing connection
  process.once("SIGINT", async () => {
    console.debug("SIGINT received, closing Server connection");
    await rpc.destroy();
    await dht.destroy();
    console.debug("Server connection closed");
  });

  return rpcServer.publicKey.toString("hex");
};

export default async ({ clientName }) => {
  try {
    return await main({ clientName });
  } catch (error) {
    console.info("rpc server error");
    console.error(error);
  }
};
