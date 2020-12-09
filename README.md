<a href="#top" id="top">
  <img src="https://user-images.githubusercontent.com/441546/101694946-bda8ef00-3a28-11eb-8d4f-e3629fd94d4c.png" style="max-width: 100%;">
</a>
<p align="center">
  <a href="https://www.npmjs.com/package/@darkobits/saffron"><img src="https://img.shields.io/npm/v/@darkobits/saffron.svg?style=flat-square"></a>
  <a href="https://travis-ci.com/github/darkobits/saffron"><img src="https://img.shields.io/travis/com/darkobits/saffron.svg?style=flat-square"></a>
  <a href="https://david-dm.org/darkobits/saffron"><img src="https://img.shields.io/david/darkobits/saffron.svg?style=flat-square"></a>
  <a href="https://www.conventionalcommits.org"><img src="https://img.shields.io/badge/conventional%20commits-1.0.0-027dc6.svg?style=flat-square"></a>
</p>

Saffron is an opinionated integration between [Yargs](https://github.com/yargs/yargs)
and [Cosmiconfig](https://github.com/davidtheclark/cosmiconfig), two
best-in-class tools for building robust command-line applications in Node.
General familiarity with these tools is recommended before using Saffron.

The core feature of Saffron is the utilization of [`yargs.config()`](https://github.com/yargs/yargs/blob/master/docs/api.md#configobject)
to pass data loaded by Cosmiconfig into Yargs, where Yargs can then perform
normalization, validation, and set defaults... all in one place.

In addition to this, Saffron applies some opinionated settings to both Yargs and
Cosmiconfig to encourage consistency and best practices.

* [Rationale](#rationale)
* [Install](#install)
* [Getting Started](#getting-started)
* [API](#api)
* [TypeScript Integration](#typescript-integration)
* [Caveats](#caveats)
* [Addenda](#addenda)

## Rationale

Yargs is arguably the best command-line argument parser in the Node ecosystem.
However, its API has grown tremendously over the years to support the myriad
idiosyncratic use-cases of its users, leading to bloat. And while it does have
limited support for loading configuration files, it only supports files in the
JSON format.

Saffron focuses on what it thinks is the most flexible, robust Yargs API, the
[command module API](https://github.com/yargs/yargs/blob/master/docs/api.md#commandmodule),
which supports almost every Yargs use-case while only involving a single Yargs
method (`.command()`)

Cosmiconfig is an extremely powerful and configurable utility for adding support
for configuration files to an application in several different formats, giving
users the ability to choose between JSON, YAML, and JavaScript-based
configuration files with a single tool.

Saffron aims to integrate these two tools, solving for many common cases,
applying sensible defaults where it can, and generally making it as easy as
possible to write robust CLIs in as few lines of code as possible.

## Install

To install Saffron:

```
npm install @darkobits/saffron
```

## Getting Started

Let's imagine we are building a CLI that will help us reticulate splines. The
CLI has the following requirements:

* It must be provided 1 positional argument, `spline`, indicating the spline to
  be reticulated.
* It may be provided 1 optional named argument, `algorithm`, indicating the
  reticulation algorithm to use. Valid algorithms are `RTA-20`, `RTA-21`, and
  `RTA-22`. If omitted, the default algorithm should be `RTA-21`.
* These options may be provided as command-line arguments or supplied via a
  configuration file, `.spline-reticulator.yml` located in or above the user's
  current directory.

Let's build-out a quick CLI for this application to make sure options/arguments
are being processed per the above requirements.

> `package.json (abridged)`

```json
{
  "name": "@fluffykins/spline-reticulator",
  "version": "0.1.0",
  "description": "Reticulates splines using various algorithms.",
  "dependencies": {
    "@darkobits/saffron": "^X.Y.Z"
  }
}
```

> `cli.js`

```ts
import cli from '@darkobits/saffron';

cli.command({
  command: '* <spline>',
  builder: ({command}) => {
    // Add some additional information about the "spline" positional argument.
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
  handler: ({argv}) => {
    // This is where we would normally call our application's main function, but
    // let's just log the configuration we got from Saffron.
    console.log(argv);
  }
})

// Once we have registered all commands for our application, be sure
// to call init.
cli.init();
```

First, lets try invoking `spline-reticulator --help` to make sure our usage
instructions look okay:

> `Command Line`

```
$ spline-reticulator --help

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

Notice that the description used above was derived from the `description` field
of our `package.json`. This is a sensible default, but can be customized by
providing a `description` option in our command definition.

We can verify that our CLI works as expected by calling it in various ways, and
ensuring it uses a configuration file when present:

> `Command Line`

```
$ spline-reticulator 402B

{
  '$0': 'spline-reticulator',
  _: [],
  spline: '402B'
  algorithm: 'RTA-21',
}
```

Because this invocation was valid, Yargs invoked our handler, which logged-out
the parsed arguments object. Let's provide an invalid algorithm and ensure that
Yargs catches this mistake:

> `Command Line`

```
$ spline-reticulator 402B --algorithm RTA-16

spline-reticulator <spline>

Reticulates splines using various algorithms.

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

Notice the `Invalid values:` section at the end, indicating the erroneous
reticulation algorithm.

Let's try adding a configuration file and ensure that Saffron loads it
correctly. By default, Saffron will use the un-scoped portion of the `name`
field from your project's `package.json` -- that is, the part after the `/` or
the entire name if it doesn't have a scope. Since our package is named
`@fluffykins/spline-reticulator`, Saffron will use `spline-reticulator` as the
base name when searching for configuration files. One of the default supported
configuration file types would thus be `.spline-reticulator.yml`. If this file
is found in or above the directory from which we invoked our application, it
would be loaded and merged with any arguments provided.

> `.spline-reticulator.yml`

```yml
algorithm: RTA-22
```

> `Command Line`

```
$ spline-reticulator 402B

{
  '$0': 'spline-reticulator'
  _: [],
  spline: '402B',
  algorithm: 'RTA-22',
}
```

Notice we did not provide an `--algorithm` argument, and the default algorithm
`RTA-21` has been superseded by `RTA-22`, which was loaded from our
`.spline-reticulator.yml` file. Wowza!

For more information about supported configuration file formats, see the
[`config.searchPlaces`](https://github.com/darkobits/saffron#configsearchplaces)
option.

## API

Saffron consists of 2 functions: `command` and `init`. The `command` function is
almost identical to Yargs' `command()` function (object form) with several
additional options. The `init` function is analogous to "calling" `yargs.argv`
to initialize the argument parser.

When building CLIs with Saffron, you should call `command` once for each command
you need to register for your application, then call `init`.

### `command(options: SaffronOptions): void`

Saffron's `command` function accepts a single options object, the API for which
is very similar to that of Yargs' [command module API](https://github.com/yargs/yargs/blob/master/docs/api.md#commandmodule),
which configures each command for an application using a single object as
opposed to the more idiomatic Yargs approach of chaining method calls.

The interface for this object is defined below.

#### `command`

**Type:** `string`<br>
**Required:** No<br>
**Default:** `'*'`

Name of the command being implemented. If your application only implements a
"root" command and does not take any positional arguments, this option can be
omitted. If your application does take positional arguments, they _must_ be
defined as part of this option using `<>` to wrap required arguments and `[]` to
wrap optional arguments. Positionals may then be further annotated in the
builder function using [`.positional`](https://github.com/yargs/yargs/blob/master/docs/api.md#positionalkey-opt).

See: [Positional Arguments](https://github.com/yargs/yargs/blob/master/docs/advanced.md#positional-arguments)

**Note:** This option is a pass-through to Yargs' `command` option.

<a href="#top" title="Back to top"><img src="https://user-images.githubusercontent.com/441546/67830932-d6ab4680-fa99-11e9-9870-bc6d31db5a1b.png"></a>

#### `aliases`

**Type:** `Array<string>`<br>
**Required:** No<br>
**Default:** N/A

Only practical when implementing sub-commands, this option allows you to specify
a list of aliases for the command.

See: [Command Aliases](https://github.com/yargs/yargs/blob/master/docs/advanced.md#command-aliases)

**Note:** This option is a pass-through to Yargs' `aliases` option.

<a href="#top" title="Back to top"><img src="https://user-images.githubusercontent.com/441546/67830932-d6ab4680-fa99-11e9-9870-bc6d31db5a1b.png"></a>

#### `description`

**Type:** `string`<br>
**Required:** No<br>
**Default:** See below.

Description for the command. If left blank, Saffron will use the `description`
field from your project's `package.json`.

Note that if you use [`.usage()`](https://github.com/yargs/yargs/blob/master/docs/api.md#usagemessagecommand-desc-builder-handler)
in your builder function, it will override this description.

**Note:** This option is a pass-through to Yargs' `describe` option.

<a href="#top" title="Back to top"><img src="https://user-images.githubusercontent.com/441546/67830932-d6ab4680-fa99-11e9-9870-bc6d31db5a1b.png"></a>

#### `builder`

**Type:** `function`<br>
**Required:** Yes<br>
**Default:** N/A

Similar to the `builder` option used when defining a Yargs command module. The
signature of this function in Saffron differs slightly from the Yargs version;
it is passed a single object with the following keys:

|Key|Description|
|:--|:--|
|`command`|Yargs [command builder](https://github.com/yargs/yargs/blob/master/docs/api.md).|
|`config`|Parsed configuration from Cosmiconfig.|
|`configPath`|Path where Cosmiconfig found a configuration file, if any.|
|`configIsEmpty`|True if a configuration file was found, but was empty. It is often a good idea to warn users in this case.|
|`packageJson`|[Normalized](https://github.com/npm/normalize-package-data) `package.json` for the application. Useful if you want to print the current version somewhere, for example.|
|`packageRoot`|Absolute path to the application's root (the directory containing `package.json`)|

This function will be passed an object that will allow you to further configure
a command. The API exposed by this object is almost identical to that of Yargs
itself, but the context is scoped to the command defined by `command`, making
this API preferable to using the global Yargs object. The [.positional()](https://github.com/yargs/yargs/blob/master/docs/api.md#positionalkey-opt)
and [.option()](https://github.com/yargs/yargs/blob/master/docs/api.md#optionkey-opt)
methods will be the most-used in your builder to define the arguments for the
command.

<a href="#top" title="Back to top"><img src="https://user-images.githubusercontent.com/441546/67830932-d6ab4680-fa99-11e9-9870-bc6d31db5a1b.png"></a>

#### `config`

**Type:** `object | false`<br>
**Required:** No<br>
**Default:** See below.

Settings for Cosmiconfig, which is responsible for locating and parsing your
application's configuration file. In addition to the below options, this object
may carry any valid [Cosmiconfig option](https://github.com/davidtheclark/cosmiconfig/blob/master/src/index.ts#L36).

Alternatively, this option may be set to `false` to disable configuration file
support entirely.

<a href="#top" title="Back to top"><img src="https://user-images.githubusercontent.com/441546/67830932-d6ab4680-fa99-11e9-9870-bc6d31db5a1b.png"></a>

##### `config.auto`

**Type:** `boolean`<br>
**Required:** No<br>
**Default:** `true`

By default, after loading an application's configuration file, Saffron will call
Yargs' `.config()` method, passing it the data from the configuration file. This
will have the effect of allowing configuration data to serve as default values
for any arguments the application accepts. This is referred to as
auto-configuration.

If an application's command-line argument schema and configuration schema
differ, auto-configuration would not be desirable. In such cases, `auto` may be
set to `false`, and Saffron will only load an application's configuration file
and pass its contents to `builder` and `handler` functions without calling
`.config()`.

<a href="#top" title="Back to top"><img src="https://user-images.githubusercontent.com/441546/67830932-d6ab4680-fa99-11e9-9870-bc6d31db5a1b.png"></a>

##### `config.fileName`

**Type:** `string`<br>
**Required:** No<br>
**Default:** See below.

By default, Saffron will use the un-scoped portion of your application's name
from its `package.json`. If you would prefer to use a different base name for
configuration files, you may provide your own `fileName` option. This is
equivalent to the `moduleName` value used [throughout the Cosmiconfig documentation](https://github.com/davidtheclark/cosmiconfig#usage).

<a href="#top" title="Back to top"><img src="https://user-images.githubusercontent.com/441546/67830932-d6ab4680-fa99-11e9-9870-bc6d31db5a1b.png"></a>

##### `config.key`

**Type:** `string`<br>
**Required:** No<br>
**Default:** N/A

For complex applications with multiple sub-commands, it may be desirable to
scope configuration for a particular sub-command to a matching key in the
application's configuration file. If this option is set, Saffron will only use
data under this key (rather than the entire file) to configure the command.

<a href="#top" title="Back to top"><img src="https://user-images.githubusercontent.com/441546/67830932-d6ab4680-fa99-11e9-9870-bc6d31db5a1b.png"></a>

##### `config.searchPlaces`

**Type:** `Array<string>`<br>
**Required:** No<br>
**Default:** See below.

Saffron overrides the default [`searchPlaces` option in Cosmiconfig](https://github.com/davidtheclark/cosmiconfig#searchplaces)
with the below defaults, where `fileName` is the base file name for your
application as derived from `package.json` or as indicated at `config.fileName`
(see above). Using our example package name of `@fluffykins/spline-reticulator`,
the below snippet has been annotated with examples of the exact file names
Saffron would search for.

```js
[
  // Look for a "spline-reticulator" key in package.json.
  'package.json',
  // Look for .spline-reticulator.json in JSON format.
  `.${fileName}.json`,
  // Look for .spline-reticulator.yaml in YAML format.
  `.${fileName}.yaml`,
  // Look for .spline-reticulator.yml in YAML format.
  `.${fileName}.yml`,
  // Look for spline-reticulator.config.js that exports a configuration object.
  `${fileName}.config.js`
];
```

For comparison, the default Cosmiconfig `searchPlaces` can be found [here](https://github.com/davidtheclark/cosmiconfig#searchplaces).

<a href="#top" title="Back to top"><img src="https://user-images.githubusercontent.com/441546/67830932-d6ab4680-fa99-11e9-9870-bc6d31db5a1b.png"></a>

##### `config.searchFrom`

**Type:** `string`<br>
**Required:** No<br>
**Default:** `process.cwd()`

Directory to begin searching for a configuration file. Cosmiconfig will then
walk up the directory tree from this location until a configuration file is
found or the root is reached.

<a href="#top" title="Back to top"><img src="https://user-images.githubusercontent.com/441546/67830932-d6ab4680-fa99-11e9-9870-bc6d31db5a1b.png"></a>

#### `strict`

**Type:** `boolean`<br>
**Required:** No<br>
**Default:** `true`

Whether to configure Yargs to use strict mode. In strict mode, any additional
options passed via the CLI or found in a configuration file will cause Yargs to
exit the program and report an error. This is generally a good idea because it
helps catch typos from user input.

However, if your application's configuration file supports more options than you
would like to consume via the CLI, then you will need to disable strict mode.
Also be aware that because these additional options will not be defined in your
builder, Yargs will not perform any validation on them.

<a href="#top" title="Back to top"><img src="https://user-images.githubusercontent.com/441546/67830932-d6ab4680-fa99-11e9-9870-bc6d31db5a1b.png"></a>

#### `handler`

**Type:** `function`<br>
**Required:** Yes<br>
**Default:** N/A

Similar to the `handler` option used when defining a Yargs command module. The
signature of this function in Saffron differs slightly from the Yargs version;
it is passed a single object with the following keys:

|Key|Description|
|:--|:--|
|`argv`|Parsed/merged/validated arguments/configuration from Yargs and Cosmiconfig.|
|`config`|Parsed configuration from Cosmiconfig.|
|`configPath`|Path where Cosmiconfig found a configuration file, if any.|
|`configIsEmpty`|True if a configuration file was found, but was empty. It is often a good idea to warn users in this case.|
|`packageJson`|[Normalized](https://github.com/npm/normalize-package-data) `package.json` for the application. Useful if you want to print the current version somewhere, for example.|
|`packageRoot`|Absolute path to the application's root (the directory containing `package.json`)|

<a href="#top" title="Back to top"><img src="https://user-images.githubusercontent.com/441546/67830932-d6ab4680-fa99-11e9-9870-bc6d31db5a1b.png"></a>

### `init(cb?: (yargs) => void): void`

This function should be called once all commands have been configured to
initialize the Yargs parser, equivalent to accessing `yargs.argv`. It accepts an
optional callback that will be passed the global `yargs` object which you can
use to perform any global operations with Yargs.

> `cli.ts`

```ts
import cli from '@darkobits/saffron';

cli.command({
  // ...
});

cli.init();

// Or:

cli.init(yargs => {
  // Advanced/custom Yargs config here.
});
```

## TypeScript Integration

Saffron is written in TypeScript and leverages Yargs' excellent TypeScript
support. If you have created a type definition for your application's
configuration/command-line arguments, it may be passed to Saffron as a type
argument and Saffron will ensure that the objects passed to your builder and
handlers are appropriately typed:

```ts
import cli from '@darkobits/saffron';

interface SplineReticulatorOptions {
  spline: string;
  algorithm: 'RTA-20' | 'RTA-21' | 'RTA-22';
}

cli.command<SplineReticulatorOptions>({
  handler: ({argv}) => {
    // Here, TypeScript will know that argv.spline is of type 'string' and that
    // argv.algorithm is an enum.
  }
});

cli.init();
```

If the schema for your application's arguments and configuration differs, a
second type argument may be provided to distinguish the argument schema from the
configuration schema:

```ts
import cli from '@darkobits/saffron';

interface SplineReticulatorArguments {
  spline: string;
  algorithm: 'RTA-20' | 'RTA-21' | 'RTA-22';
}

interface SplineReticulatorConfiguration {
  // ...
}

cli.command<SplineReticulatorArguments, SplineReticulatorConfiguration>({
  builder: ({config}) => {
    // Here, config will be of type SplineReticulatorConfiguration.
  },
  handler: ({argv, config}) => {
    // Here, argv will be of type SplineReticulatorArguments and config will be
    // of type SplineReticulatorConfiguration.
  }
});

cli.init();
```

## Caveats

* If your application has required positional arguments, these **must** be
  provided via the command-line. This is a Yargs limitation.

## Addenda

**Why Saffron?**

Cosmiconfig is an excellent space-themed configuration loader. Yargs is an
excellent pirate-themed argument parser. [Saffron](https://en.wikipedia.org/wiki/List_of_Firefly_(TV_series)_characters#Saffron)
is a [space pirate](https://en.wikipedia.org/wiki/List_of_space_pirates) from
the excellent [Firefly](https://en.wikipedia.org/wiki/Firefly_(TV_series))
series.

## See Also

* [Command-Line Interface Guidelines](https://clig.dev) – An open-source guide
  to help you write better command-line programs.

<br />
<a href="#top">
  <img src="https://user-images.githubusercontent.com/441546/101694731-67d44700-3a28-11eb-92af-82f9a41fe88e.png" style="max-width: 100%;">
</a>
