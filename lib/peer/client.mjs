"use strict";

import RPC from "@hyperswarm/rpc";
import DHT from "hyperdht";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import crypto from "crypto";

const parseCmd = (cmd) => {
  const [command, ...args] = cmd.trim().split(":");
  return { command, args };
};

const sell = async ({ args }) => {
  const [ticker, price] = args;
  console.log("sell", { ticker, price });
};

const ping = async ({ rpc, targetPubKeyBuffer }) => {
  // payload for request
  const payload = { nonce: 126 };
  const payloadRaw = Buffer.from(JSON.stringify(payload), "utf-8");

  // sending request and handling response
  // see console output on server code for public key as this changes on different instances
  const respRaw = await rpc.request(targetPubKeyBuffer, "ping", payloadRaw);
  const resp = JSON.parse(respRaw.toString("utf-8"));

  console.log(resp); // { nonce: 127 }
};

const onCommand = async ({ command, args }, rpc, ownPubKeyBuffer) => {
  switch (command) {
    case "ping":
      await ping({ rpc, targetPubKeyBuffer: ownPubKeyBuffer });
      break;
    case "sell":
      await sell({ args });
      break;
    case "bid":
      await bid({ args });
      break;
    case "terminate":
      await terminate({ args });
      break;
    case "exit":
      await terminateAll();
      break;
    default:
      console.log("unknown command");
      break;
  }
};
const main = async ({ serverPubKey, clientName }) => {
  // hyperbee db
  const hcore = new Hypercore(`./db/rpc-client/${clientName}`);
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
    port: 50001,
    keyPair: DHT.keyPair(dhtSeed),
    bootstrap: [{ host: "127.0.0.1", port: 30001 }], // note boostrap points to dht that is started via cli
  });
  // @TODO: this should add the other peers to a db so that we can connect to them later
  dht.on("connection", (...args) => {
    console.log(`${clientName} connected to peer:`);

    console.log(args);
  });
  await dht.ready();

  // public key of rpc server, used instead of address, the address is discovered via dht

  const serverPubKeyBuffer = Buffer.from(serverPubKey, "hex");

  // rpc lib
  const rpc = new RPC({ dht });

  process.stdin.on("data", async (data) => {
    await onCommand(parseCmd(data.toString()), rpc, serverPubKeyBuffer);
  });

  // closing connection
  process.once("SIGINT", async () => {
    console.debug("SIGINT received, closing Client connection");
    await rpc.destroy();
    await dht.destroy();
    console.debug("Client connection closed");
  });
};

export default async ({ serverPubKey, clientName }) => {
  try {
    await main({ serverPubKey, clientName });
  } catch (error) {
    console.log("rpc client error");
    console.error(error);
  }
};
