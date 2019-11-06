<a href="#top" id="top">
  <img src="https://user-images.githubusercontent.com/441546/68170118-62522680-ff23-11e9-9600-1f0af2854c96.png" style="max-width: 100%;">
</a>
<p align="center">
  <a href="https://www.npmjs.com/package/@darkobits/ridley"><img src="https://img.shields.io/npm/v/@darkobits/ridley.svg?style=flat-square"></a>
  <a href="https://github.com/darkobits/ridley/actions"><img src="https://img.shields.io/endpoint?url=https://aws.frontlawn.net/ga-shields/darkobits/log&style=flat-square"></a>
  <a href="https://david-dm.org/darkobits/ridley"><img src="https://img.shields.io/david/darkobits/ridley.svg?style=flat-square"></a>
  <a href="https://conventionalcommits.org"><img src="https://img.shields.io/badge/conventional%20commits-1.0.0-FB5E85.svg?style=flat-square"></a>
</p>

Ridley is an opinionated integration between [Yargs](https://github.com/yargs/yargs) and [Cosmiconfig](https://github.com/davidtheclark/cosmiconfig), two best-in-class tools for building robust command-line applications in Node. General familiarity with these tools is recommended before using Ridley.

The core feature of Ridley is the utilization of [`yargs.config()`](https://github.com/yargs/yargs/blob/master/docs/api.md#configobject) to pass data loaded by Cosmiconfig into Yargs, where we can then perform normalization, validation, set defaults (and more) all in one place.

In addition to this, Ridley applies some opinionated settings to both Yargs and Cosmiconfig to encourage consistency and best practices.

* [Install](#install)
* [Getting Started](#getting-started)
* [API](#api)
* [TypeScript Integration](#typescript-integration)
* [Caveats](#caveats)

## Install

```
npm i @darkobits/ridley
```

## Getting Started

Let's assume we are building a CLI that will help us reticulate splines. The CLI has the following requirements:

* It must be provided 1 required positional argument, `spline`, indicating the spline to be reticulated.
* It may be provided 1 optional named argument, `algorithm`, indicating the reticulation algorithm to use. Valid algorithms are `RTA-20`, `RTA-21`, and `RTA-22`. If omitted, the default algorithm should be `RTA-21`.
* These options may be provided as command-line arguments or via a file, `.spline-reticulator.yml` located in or above the user's current directory.

Let's build-out a quick CLI for this application to make sure options/arguments are being processed per the above requirements.

> `cli.ts`

```ts
import cli from '@darkobits/ridley';
// Or, if you prefer:
import {command, init} from '@darkobits/ridley';

cli.command({
  command: '* <spline>',
  description: 'Reticulates splines using various algorithms.'
  builder: command => {
    // Add some addtional information about the "spline" positional argument.
    command.positional('spline', {
      description: 'Identifier of the spline to reticulate.',
      type: 'string'
    });

    // Define the "algorithm" named argument.
    command.option('algorithm', {
      description: 'Reticulation algorithm to use.',
      type: 'string',
      required: false,
      enum: ['RTA-20', 'RTA-21', 'RTA-22'],
      default: 'RTA-21'
    });
  },
  handler: config => {
    // This is where we would normally call our application, but let's just log
    // the configuration we got.
    console.log(config);
  }
})

// Once you have registered all commands for your application, be sure to call init.
cli.init();
```

First, lets try invoking `spline-reticulator --help` to make sure everything looks okay:

> `Command Line`

```
$ spline-reticulator --help
```

> `Output`

```
spline-reticulator <spline>

Reticulates splines using various algorithms.

Positionals:
  spline  Identifier of the spline to reticulate.                                               [string]

Options:
  --algorithm    Reticulation algorithm to use.
                                    [string] [choices: "RTA-20", "RTA-21", "RTA-22"] [default: "RTA-21"]
  -v, --version  Show version number                                                           [boolean]
  -h, --help     Show help                                                                     [boolean]
```

We can verify that our CLI works as expected by calling it in various ways, and ensuring it uses a configuration file when present:

> `Command Line`

```
$ spline-reticulator 402B
```

> `Output`

```
{
  '$0': 'spline-reticulator',
  _: [],
  spline: '402B'
  algorithm: 'RTA-21',
}
```

Let's provide an invalid algorithm and ensure that Yargs catches this mistake:

```
spline-reticulator 402B --algorithm RTA-16
```

```
spline-reticulator <spline>

Positionals:
  spline  Identifier of the spline to reticulate.                                               [string]

Options:
  --algorithm    Reticulation algorithm to use.
                                    [string] [choices: "RTA-20", "RTA-21", "RTA-22"] [default: "RTA-21"]
  -v, --version  Show version number                                                           [boolean]
  -h, --help     Show help                                                                     [boolean]

Invalid values:
  Argument: algorithm, Given: "foo", Choices: "RTA-20", "RTA-21", "RTA-22"
```

If we are working in a project that contains splines that should always be reticulated using a specific algorithm, and we wanted to track that requirement in source control, we can leverage a configuration file to indicate the algorithm to use:

> `.spline-reticulator.yml`

```yml
algorithm: RTA-22
```

```
spline-reticulator 402B
```

```
{
  '$0': 'spline-reticulator'
  _: [],
  spline: '402B',
  algorithm: 'RTA-22',
}
```

## API

### `command`

Ridley's `command` function accepts a single options object, the API for which is very similar to that of Yargs' [command module API](https://github.com/yargs/yargs/blob/master/docs/api.md#commandmodule), which configures each command using a single options object rather than by chaining several method calls.

The interface for this object is defined below.

##### `command`

**Type:** `string`<br>
**Required:** Yes<br>
**Default:** `'*'`

Name of the command being implemented, or `*` to handle the root command. This is also where any positional arguments should be defined, using `<>` to wrap required arguments and `[]` to wrap optional arguments. Positionals may then be annotated with additional metadata in the builder function using [`.positional`](https://github.com/yargs/yargs/blob/master/docs/api.md#positionalkey-opt).

See: [Positional Arguments](https://github.com/yargs/yargs/blob/master/docs/advanced.md#positional-arguments)

**Note:** This option is a pass-through to Yargs' `command` option.

#### `aliases`

**Type:** `Array<string>`<br>
**Required:** No<br>
**Default:** N/A

Only practical when implementing sub-commands, this option allows you to specify a list of aliases for the command.

See: [Command Aliases](https://github.com/yargs/yargs/blob/master/docs/advanced.md#command-aliases)

**Note:** This option is a pass-through to Yargs' `aliases` option.

#### `description`

**Type:** `string`<br>
**Required:** No<br>
**Default:** See below.

Top-level description for the command itself. If left blank, Ridley will use the `description` field from your project's `package.json`.

Note that if you use [`.usage()`](https://github.com/yargs/yargs/blob/master/docs/api.md#usagemessagecommand-desc-builder-handler) in your builder function, it will override this description.

**Note:** This option is a pass-through to Yargs' `describe` option.

#### `builder`

**Type:** `(command: Argv): void`<br>
**Required:** Yes<br>
**Default:** N/A

This function will be passed an object that will allow you to further configure the command. The API exposed by this object is almost identical to that of Yargs itself, but the context you are configuring is scoped to the command defined by `command`, making this API preferable to using the global Yargs object. The [.positional()](https://github.com/yargs/yargs/blob/master/docs/api.md#positionalkey-opt) and [.option()](https://github.com/yargs/yargs/blob/master/docs/api.md#optionkey-opt) methods will be the most-used in your builder to define the options for the command.

**Note:** This option is a pass-through to Yargs' `builder` option.

#### `config`

**Type:** [`CosmiconfigOptions`](https://github.com/davidtheclark/cosmiconfig/blob/master/src/index.ts#L36)<br>
**Required:** No<br>
**Default:** See below.

Allows for configuration of Cosmiconfig. This object also supports the `moduleName` option, which is typically provided as a separate parameter to Cosmiconfig. By default, Ridley will use the unscoped part of the `name` field from your project's `package.json` (re: the portion after the `/`, if it has one, or the entire name otherwise).

Therefore, if our package's name was `spline-reticulator`, and no `config.moduleName` option was provided, Ridley will use `spline-reticulator` as the module name. This will be provided to the call to Cosmiconfig to initialize it. It will also be used to set a custom set of search paths for configuration file names shown below:

```js
[
  // Look for a "spline-reticulator" key in package.json.
  'package.json',
  // Look for .spline-reticulatorrc in JSON or YAML format.
  `.${moduleName}rc`,
  // Look for .spline-reticulator.json in JSON format.
  `.${moduleName}.json`,
  // Look for .spline-reticulator.yaml in YAML format.
  `.${moduleName}.yaml`,
  // Look for .spline-reticulator.yml in YAML format.
  `.${moduleName}.yml`,
  // Look spline-reticulator.config.js that exports a configuration object.
  `${moduleName}.config.js`,
];
```

**Note:** This object is a pass-through to Cosmiconfig.

#### `strict`

**Type:** `boolean`<br>
**Required:** No<br>
**Default:** `true`

Whether to configure Yargs to use strict mode. In strict mode, any additional options passed via the CLI or found in a configuration file will cause Yargs to exit the program. This is generally a good idea because it helps catch typos. However, if your application's configuration file supports more options than you would like to consume via the CLI, then you will need to disable strict mode. Also be aware that because these additional options will not be defined in your builder, Yargs will not perform any validation on them.

#### `handler`

**Type:** `(result: RidleyResult): void`<br>
**Required:** Yes<br>
**Default:** N/A

Identical to the `handler` option used when defining a Yargs command module. This function will be provided parsed/validated arguments/options. The signature of this function in Ridley differs slightly from the Yargs version; it is passed a single object with the following keys:

|Key|Description|
|:--|:--|
|`argv`|Parsed arguments/configuration from Yargs with all kebab-case keys stripped.|
|`rawConfig`|Parsed configuration from Cosmiconfig. This is usually not required. However, if the same option was set via both a command-line argument and a configuration file, the argument will take precedence in `argv`. Therefore, when conflicts occur, this object can be used to check the value from the configuration file.|
|`configPath`|Path where Cosmiconfig found a configuration file, if any.|
|`configIsEmpty`|True if a configuration file was found, but was empty. It is often a good idea to warn users in this case.|
|`packageJson`|[Normalized](https://github.com/npm/normalize-package-data) `package.json` for the application. Useful if you want to print the current version somewhere, for example.|
|`packageJsonPath`|Absolute path to the application's `package.json`.|
|`packageRoot`|Absolute path to the application's root (the directory containing `package.json`)|

### `init`

This function should be called once all commands have been configured to initialize the Yargs parser, equivalent to accessing `yargs.argv`.

**Note:** The order in which you register your commands matters, and will affect the appearance of help output.

## TypeScript Integration

Ridley is written in TypeScript and leverages Yargs' excellent TypeScript support. If you have created a type definition for your application's configuration/command-line arguments, it may be passed to Ridley as a type argument and Ridley will ensure the object passed to your handler is appropriately typed.

**Example**

```ts
import cli from '@darkobits/ridley';

interface SplineReticulatorOptions {
  spline: string;
  algorithm: 'RTA-20' | 'RTA-21' | 'RTA-22';
}

cli.command<SplineReticulatorOptions>({
  handler: ({argv}) => {
    // TypeScript will know that argv.spline is of type 'string' here.
  }
});

cli.init();
```

## Caveats

* If your application has required positional arguments, these **must** be provided via the command-line. This is a Yargs limitation.

## &nbsp;
<p align="center">
  <br>
  <img width="22" height="22" src="https://cloud.githubusercontent.com/assets/441546/25318539/db2f4cf2-2845-11e7-8e10-ef97d91cd538.png">
</p>
