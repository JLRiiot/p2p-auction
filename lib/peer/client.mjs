"use strict";

import RPC from "@hyperswarm/rpc";
import DHT from "hyperdht";
import Corestore from "corestore";
import Hyperbee from "hyperbee";
import crypto from "crypto";

const parseCmd = (cmd) => {
  const [command, ...args] = cmd.trim().split(":");
  return { command, args };
};

const sell = async ({ args }, rpc, ownPubKeyBuffer, clientName) => {
  const [ticker, price] = args;

  const payload = { ticker, price };
  const payloadRaw = Buffer.from(JSON.stringify(payload), "utf-8");

  const resRaw = await rpc.request(ownPubKeyBuffer, "sell", payloadRaw);

  const res = JSON.parse(resRaw.toString("utf-8"));
};

const bid = async ({ args }, rpc, _ownPubKeyBuffer, clientName) => {
  const [ticker, price, targetPubKeyStr] = args;
  const targetPubKeyBuffer = Buffer.from(targetPubKeyStr, "hex");
  console.log("bid", { ticker, price });

  // payload for request
  const payload = { ticker, price, bidder: clientName };
  const payloadRaw = Buffer.from(JSON.stringify(payload), "utf-8");

  // sending request and handling response
  // see console output on server code for public key as this changes on different instances
  const respRaw = await rpc.request(targetPubKeyBuffer, "bid", payloadRaw);

  const resp = JSON.parse(respRaw.toString("utf-8"));
};

const terminate = async ({ args }, rpc, ownPubKeyBuffer) => {
  const [ticker] = args;

  const payload = { ticker };

  const payloadRaw = Buffer.from(JSON.stringify(payload), "utf-8");

  const resRaw = await rpc.request(ownPubKeyBuffer, "terminate", payloadRaw);

  const res = JSON.parse(resRaw.toString("utf-8"));
};

const terminateAll = async ({ args }, rpc, ownPubKeyBuffer) => {
  console.log("terminateAll");
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

const onCommand = async (
  { command, args },
  rpc,
  ownPubKeyBuffer,
  clientName
) => {
  switch (command) {
    case "ping":
      await ping({ rpc, targetPubKeyBuffer: ownPubKeyBuffer });
      break;
    case "sell":
      await sell({ args }, rpc, ownPubKeyBuffer, clientName);
      break;
    case "bid":
      await bid({ args }, rpc, ownPubKeyBuffer, clientName);
      break;
    case "terminate":
      await terminate({ args }, rpc, ownPubKeyBuffer, clientName);
      break;
    case "exit":
      await terminateAll(rpc, ownPubKeyBuffer, sellingsBee);
      break;
    default:
      console.log("unknown command");
      break;
  }
};
const main = async ({ serverPubKey, clientName }) => {
  // hyperbee db
  const store = new Corestore(`./db/rpc-client/${clientName}`);
  const rpcClientCore = store.get({
    name: "rpc-client",
    valueEncoding: "binary",
  });
  const sellingsCore = store.get({
    name: "sellings",
    valueEncoding: "binary",
  });
  const sellingsBee = new Hyperbee(sellingsCore, {
    keyEncoding: "utf-8",
    valueEncoding: "binary",
  });
  const rpcClientBee = new Hyperbee(rpcClientCore, {
    keyEncoding: "utf-8",
    valueEncoding: "binary",
  });
  await Promise.all([rpcClientBee.ready(), sellingsBee.ready()]);

  // resolved distributed hash table seed for key pair
  let dhtSeed = (await rpcClientBee.get("dht-seed"))?.value;
  if (!dhtSeed) {
    // not found, generate and store in db
    dhtSeed = crypto.randomBytes(32);
    await rpcClientBee.put("dht-seed", dhtSeed);
  }

  // start distributed hash table, it is used for rpc service discovery
  const dht = new DHT({
    port: 50001,
    keyPair: DHT.keyPair(dhtSeed),
    bootstrap: [{ host: "127.0.0.1", port: 30001 }], // note boostrap points to dht that is started via cli
  });

  await dht.ready();

  const serverPubKeyBuffer = Buffer.from(serverPubKey, "hex");

  // rpc lib
  const rpc = new RPC({ dht });

  process.stdin.on("data", async (data) => {
    await onCommand(
      parseCmd(data.toString()),
      rpc,
      serverPubKeyBuffer,
      clientName
    );
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
