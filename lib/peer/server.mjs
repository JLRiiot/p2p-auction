"use strict";

import RPC from "@hyperswarm/rpc";
import DHT from "hyperdht";
import Corestore from "corestore";
import Hyperbee from "hyperbee";
import Hyperswarm from "hyperswarm";
import b4a from "b4a";
import crypto from "crypto";

const notifyClients = async ({ rpcStoreBee, sellOrder, rpc, event }) => {
  const currentConnBuffer = (await rpcStoreBee.get("connections"))?.value;
  const currentConnStr = b4a.toString(currentConnBuffer);
  const currentConnections = JSON.parse(currentConnStr);

  const allConnections = new Map(currentConnections ? currentConnections : []);

  const rawSellOrder = Buffer.from(JSON.stringify(sellOrder), "utf-8");

  for (const [_socketPubKey, rpcPubKey] of allConnections) {
    const rpcPubKeyBuffer = Buffer.from(rpcPubKey, "hex");
    await rpc.event(rpcPubKeyBuffer, event, rawSellOrder);
  }
};

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

  const swarm = new Hyperswarm({
    dht,
    keyPair: DHT.keyPair(dhtSeed),
  });

  // @TODO: this should add the other peers to a db so that we can connect to them later
  swarm.on("connection", (socket, info) => {
    socket.on("data", async (data) => {
      const rpcPubKey = b4a.toString(data, "hex");
      const socketPubKey = b4a.toString(socket.remotePublicKey, "hex");
      const currentConnBuffer =
        (await rpcStoreBee.get("connections"))?.value || Buffer.from("[]");
      const currentConnStr = b4a.toString(currentConnBuffer);
      const currentConnections = JSON.parse(currentConnStr);

      const allConnections = new Map(
        currentConnections ? currentConnections : []
      );
      allConnections.set(socketPubKey, rpcPubKey);
      const rawData = Buffer.from(JSON.stringify(Array.from(allConnections)));

      console.log("------------------\n");
      console.log("Connection:", allConnections.values());

      await rpcStoreBee.put("connections", rawData);
    });

    socket.once("close", async () => {
      const socketPubKey = b4a.toString(socket.remotePublicKey, "hex");
      const currentConnBuffer =
        (await rpcStoreBee.get("connections"))?.value || Buffer.from("[]");
      const currentConnStr = b4a.toString(currentConnBuffer);
      const currentConnections = JSON.parse(currentConnStr);

      const allConnections = new Map(
        currentConnections ? currentConnections : []
      );
      allConnections.delete(socketPubKey);
      const rawData = Buffer.from(JSON.stringify(Array.from(allConnections)));

      await rpcStoreBee.put("connections", rawData);
    });

    socket.write(rpcServer.publicKey);
  });
  // @FIXME: there must be a better day to have all peers in the same topic, maybe using the bootstrap dht node.
  const topic = b4a.from(
    "763cdd329d29dc35326865c4fa9bd33a45fdc2d8d2564b11978ca0d022a44a19",
    "hex"
  );
  swarm.join(topic, {
    client: true,
    server: true,
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
      owner: clientName,
      status: "open",
      bidder: null,
      createdAt: Date.now(),
    };
    const rawData = Buffer.from(JSON.stringify(sellOrder), "utf-8");
    await sellOrdersBee.put(ticker, rawData);

    notifyClients({
      rpcStoreBee,
      sellOrder,
      rpc,
      event: "sellOrderCreated",
    });

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

      notifyClients({
        rpcStoreBee,
        sellOrder: newSellOrder,
        rpc,
        event: "bidPlaced",
      });

      const rawData = Buffer.from(JSON.stringify(newSellOrder), "utf-8");
      await sellOrdersBee.put(ticker, rawData);

      res = { accepted: true, sellOrder: newSellOrder };
    }

    const resRaw = Buffer.from(JSON.stringify(res), "utf-8");

    return resRaw;
  });

  rpcServer.respond("terminate", async (reqRaw) => {
    const { ticker } = JSON.parse(reqRaw.toString("utf-8"));

    const currentSellOrder = (await sellOrdersBee.get(ticker))?.value;

    let res = { accepted: false, reason: "no sell order found" };

    if (currentSellOrder) {
      const sellOrder = JSON.parse(currentSellOrder.toString("utf-8"));
      const updatedAt = Date.now();

      const newSellOrder = {
        ...sellOrder,
        owner: sellOrder.bidder,
        status: "terminated",
        updatedAt,
      };

      notifyClients({
        rpcStoreBee,
        sellOrder: newSellOrder,
        rpc,
        event: "sellOrderTerminated",
      });

      const rawData = Buffer.from(JSON.stringify(newSellOrder), "utf-8");
      await sellOrdersBee.put(ticker, rawData);

      res = { accepted: true, sellOrder: newSellOrder };
    }

    const resRaw = Buffer.from(JSON.stringify(res), "utf-8");

    return resRaw;
  });

  rpcServer.respond("sellOrderCreated", async (reqRaw) => {
    const sellOrder = JSON.parse(reqRaw.toString("utf-8"));
    console.log("------------------\n");
    console.log("sellOrderCreated", sellOrder);
  });

  rpcServer.respond("bidPlaced", async (reqRaw) => {
    const sellOrder = JSON.parse(reqRaw.toString("utf-8"));
    console.log("------------------\n");
    console.log("bidPlaced", sellOrder);
  });

  rpcServer.respond("sellOrderTerminated", async (reqRaw) => {
    const sellOrder = JSON.parse(reqRaw.toString("utf-8"));
    console.log("------------------\n");
    console.log("sellOrderTerminated", sellOrder);
  });

  // closing connection
  process.once("SIGINT", async () => {
    console.debug("SIGINT received, closing Server connection");
    await swarm.destroy();
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
