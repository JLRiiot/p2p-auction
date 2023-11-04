"use strict";

import RPC from "@hyperswarm/rpc";
import DHT from "hyperdht";
import Hypercore from "hypercore";
import Corestore from "corestore";
import Hyperbee from "hyperbee";
import crypto from "crypto";

const main = async ({ clientName }) => {
  // hyperbee db
  const store = new Corestore(`./db/rpc-server/${clientName}`);
  // const hcore = new Hypercore(`./db/rpc-server/${clientName}`);
  const sellOrdersCore = store.get({
    name: "sell-orders",
    valueEncoding: "binary",
  });
  const rpcServerCore = store.get({
    name: "rpc-server",
    valueEncoding: "binary",
  });
  const rpcStoreBee = new Hyperbee(rpcServerCore, {
    keyEncoding: "utf-8",
    valueEncoding: "binary",
  });
  const sellOrdersBee = new Hyperbee(sellOrdersCore, {
    keyEncoding: "utf-8",
    valueEncoding: "binary",
  });
  await Promise.all([rpcStoreBee.ready(), sellOrdersBee.ready()]);

  // resolved distributed hash table seed for key pair
  let dhtSeed = (await rpcStoreBee.get("dht-seed"))?.value;
  if (!dhtSeed) {
    // not found, generate and store in db
    dhtSeed = crypto.randomBytes(32);
    await rpcStoreBee.put("dht-seed", dhtSeed);
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
  let rpcSeed = (await rpcStoreBee.get("rpc-seed"))?.value;
  if (!rpcSeed) {
    rpcSeed = crypto.randomBytes(32);
    await rpcStoreBee.put("rpc-seed", rpcSeed);
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

  // @FIXME: sell should not be a RPC request, it should be a client request and then the client replicates the selling data to other hypercore peers
  rpcServer.respond("sell", async (reqRaw) => {
    const { ticker, price } = JSON.parse(reqRaw.toString("utf-8"));
    const sellOrder = {
      ticker,
      price,
      bidder: null,
      createdAt: Date.now(),
    };
    const rawData = Buffer.from(JSON.stringify(sellOrder), "utf-8");
    await sellOrdersBee.put(ticker, rawData);

    const res = { accepted: true, sellOrder };
    const resRaw = Buffer.from(JSON.stringify(res), "utf-8");

    return resRaw;
  });

  rpcServer.respond("bid", async (reqRaw) => {
    const { ticker, price, bidder } = JSON.parse(reqRaw.toString("utf-8"));

    const currentSellOrder = (await sellOrdersBee.get(ticker))?.value;

    let res = { accepted: false, reason: "no sell order found" };

    if (currentSellOrder) {
      const sellOrder = JSON.parse(currentSellOrder.toString("utf-8"));
      const updatedAt = Date.now();

      const newSellOrder = {
        ...sellOrder,
        price,
        bidder,
        updatedAt,
      };

      const rawData = Buffer.from(JSON.stringify(newSellOrder), "utf-8");
      await sellOrdersBee.put(ticker, rawData);

      res = { accepted: true, sellOrder: newSellOrder };
    }

    const resRaw = Buffer.from(JSON.stringify(res), "utf-8");

    return resRaw;
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
