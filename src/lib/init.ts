import yargs from 'yargs';

import getPackageInfo from 'lib/package';

import type { SaffronInitCallback } from 'etc/types';

/**
 * Sets global defaults for Yargs, then calls `yargs.argv`, which initiates the
 * Yargs parser.
 */
export default function init(cb?: SaffronInitCallback) {
  const { pkgJson } = getPackageInfo();

  // For applications with no sub-commands, this ensures we show help properly
  // when the user calls --help from the root command. This is necessary even
  // when a default command with these same options has been configured.
  yargs.showHelpOnFail(true, 'See --help for usage instructions.');
  yargs.wrap(yargs.terminalWidth());

  if (pkgJson?.version) {
    yargs.version(pkgJson.version);
  }

  yargs.help();

  // Finally, call the provided callback, passing it the Yargs object, in the
  // event the user needs to perform any additional actions prior to parsing.
  void Promise.resolve(typeof cb === 'function' ? cb(yargs) : undefined).then(customParser => {
    // If the user returned a custom parsing callback, parse arguments
    // manually and pass the callback to `parseAsync`.
    return typeof customParser === 'function'
      ? yargs.parseAsync(process.argv.slice(2), customParser)
      // Note: This is a custom getter that acts like a function call.
      : yargs.argv;
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
