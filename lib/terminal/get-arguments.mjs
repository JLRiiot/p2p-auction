const getCommandArguments = (keys) =>
  toArgumentsDict(keys, process.argv.slice(2));

const toArgumentsDict = (keys, args) =>
  Object.fromEntries(keys.map((key, i) => [key, args[i]]));

export default getCommandArguments;
