"use strict";

import RPC from "@hyperswarm/rpc";
import DHT from "hyperdht";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import crypto from "crypto";

const main = async ({ serverPubKey }) => {
  // hyperbee db
  const hcore = new Hypercore("./db/rpc-client");
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
  await dht.ready();

  // public key of rpc server, used instead of address, the address is discovered via dht

  const serverPubKeyBuffer = Buffer.from(serverPubKey, "hex");

  // rpc lib
  const rpc = new RPC({ dht });

  // payload for request
  const payload = { nonce: 126 };
  const payloadRaw = Buffer.from(JSON.stringify(payload), "utf-8");

  // sending request and handling response
  // see console output on server code for public key as this changes on different instances
  const respRaw = await rpc.request(serverPubKeyBuffer, "ping", payloadRaw);
  const resp = JSON.parse(respRaw.toString("utf-8"));
  console.log(resp); // { nonce: 127 }

  // closing connection
  await rpc.destroy();
  await dht.destroy();
};

export default async ({ serverPubKey }) => {
  try {
    await main({ serverPubKey });
  } catch (error) {
    console.log("rpc client error");
    console.error(error);
  }
};
