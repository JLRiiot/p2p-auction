import server from "./lib/example/server.mjs";
import client from "./lib/example/client.mjs";

const main = async () => {
  const serverPubKey = await server();
  await client({ serverPubKey });
};

main().catch(console.error);
