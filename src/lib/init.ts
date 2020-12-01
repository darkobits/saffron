import yargs from 'yargs';
import {SaffronInitCallback} from 'etc/types';


/**
 * Sets global defaults for Yargs, then calls `yargs.argv`, which initiates the
 * Yargs parser.
 */
export default function init(cb?: SaffronInitCallback) {
  // For applications with no sub-commands, this ensures we show help properly
  // when the user calls --help from the root command. This is necessary even
  // when a default command with these same options has been configured.
  yargs.showHelpOnFail(true, 'See --help for usage instructions.');
  yargs.wrap(yargs.terminalWidth());
  yargs.alias('v', 'version');
  yargs.alias('h', 'help');
  yargs.version();
  yargs.help();

  // Finally, call the provided callback, passing it the Yargs object, in the
  // event the user needs to perform any additional actions prior to parsing.
  if (typeof cb === 'function') {
    cb(yargs);
  }

  // Note: This is a custom getter that acts like a function call.
  void yargs.argv;
}
