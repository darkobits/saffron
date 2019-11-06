import yargs from 'yargs';


/**
 * Sets global defaults for Yargs, then calls `yargs.argv`, which initiates the
 * Yargs parser.
 */
export default function init() {
  // For applications with no sub-commands, this ensures we show help properly
  // when the user calls --help from the root command. This is necessary even
  // when a default command with these same options has been configured.
  yargs.showHelpOnFail(true, 'See --help for usage instructions.');
  yargs.wrap(yargs.terminalWidth());
  yargs.alias('v', 'version');
  yargs.alias('h', 'help');
  yargs.version();
  yargs.help();

  // Note: This is a custom getter that acts like a function call.
  yargs.argv; // tslint:disable-line: no-unused-expression
}
