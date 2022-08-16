import { getPackageInfo  } from 'lib/package';
import yargs from 'lib/yargs';

import type { SaffronInitCallback } from 'etc/types';

/**
 * Sets global defaults for Yargs, then calls `yargs.argv`, which initiates the
 * Yargs parser.
 */
export default function init(cb?: SaffronInitCallback) {
  const hostPkg = getPackageInfo('host');

  // For applications with no sub-commands, this ensures we show help properly
  // when the user calls --help from the root command. This is necessary even
  // when a default command with these same options has been configured.
  yargs.showHelpOnFail(true, 'See --help for usage instructions.');
  yargs.wrap(yargs.terminalWidth());

  if (hostPkg.json?.version) {
    yargs.version(hostPkg.json.version);
  }

  yargs.help();

  // Finally, call the provided callback, passing it the Yargs object, in the
  // event the user needs to perform any additional actions prior to parsing.
  void Promise.resolve(typeof cb === 'function' ? cb(yargs) : undefined).then(customParser => {
    if (typeof customParser !== 'function') {
      // N.B. This is a custom getter that acts like a function call to
      // initialize Yargs.
      return yargs.argv;
    }

    // If the user returned a custom parsing callback, parse arguments manually
    // and pass the result to `parseAsync`.
    return yargs.parseAsync(process.argv.slice(2), customParser);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

// cli.init(() => (err, argv, output) => {
//   if (err) {
//     console.error(MakinUrText.fromString(err.message ?? err));
//     return;
//   }

//   if (output) {
//     console.error(MakinUrText.fromString(output));
//     return;
//   }
// });
