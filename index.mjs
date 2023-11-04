import server from "./lib/peer/server.mjs";
import client from "./lib/peer/client.mjs";
import getCommandArguments from "./lib/terminal/get-arguments.mjs";

const main = async () => {
  const { clientName } = getCommandArguments(["clientName"]);

  if (!clientName) {
    console.log("clientName is required");
    process.exit(1);
  }

  const serverPubKey = await server({ clientName });
  // the first 8 characters of the public key are used as peer id
  await client({ serverPubKey, clientName });
};

main().catch(console.error);
