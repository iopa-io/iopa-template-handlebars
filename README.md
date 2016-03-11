# [![IOPA](http://iopa.io/iopa.png)](http://iopa.io)<br> iopa-template-handlebars 

[![Build Status](https://api.shippable.com/projects/56e23af39d043da07bb6ff01/badge?branchName=master)](https://app.shippable.com/projects/56e23af39d043da07bb6ff01) 
[![IOPA](https://img.shields.io/badge/iopa-middleware-99cc33.svg?style=flat-square)](http://iopa.io)
[![limerun](https://img.shields.io/badge/limerun-certified-3399cc.svg?style=flat-square)](https://nodei.co/npm/limerun/)

[![NPM](https://nodei.co/npm/iopa-template-handlebars.png?downloads=true)](https://nodei.co/npm/iopa-template-handlebars/)

## About
`iopa-template-handlebars` is IOPA middleware for rendering templates using handlebars template engine

## Installation

```js
$ npm install iopa-template-handlebars
```

## Credits

This project, including documentation, was forked under BSD license from the Yahoo [ericf/express-handlebars](https://github.com/ericf/express-handlebars) with various changes throughout to map to IOPA vs Express.

To date, the raw parsing routines have not been adjusted materially from the Yahoo implementation.

## Goals and Features

After building a half-dozen Express apps, the original author developed requirements and opinions about what a Handlebars view engine should provide and how it should be implemented. The following is that list:

* Add the concept of "layout"

* Add the concept of "partials" via Handlebars' partials mechanism.

* Support a directories of partials; e.g., `{{> foo/bar}}` which exists on the file system at `views/partials/foo/bar.handlebars`, by default.

* Smart file system I/O and template caching. When in development, templates are always loaded from disk. In production, raw files and compiled templates are cached, including partials.

* All async and non-blocking. File system I/O is slow and servers should not be blocked from handling requests while reading from disk. I/O queuing is used to avoid doing unnecessary work.

* Ability to easily precompiled templates and partials for use on the client, enabling template sharing and reuse.

* Ability to use a different Handlebars module/implementation other than the Handlebars npm package.

### Package Design

This package was designed to work great for both the simple and complex use cases. We _intentionally_ made sure the full implementation is exposed and is easily overridable.

The package exports a function which can be invoked with no arguments or with a `config` object and it will return a function (closed over sane defaults) which can be registered with an IOPA app. It's an engine factory function.

This exported engine factory has four properties which expose the underlying implementation:

* (default):  The simplest IOPA middleware to use in `app.user(handlebars)`;

* `IopaHandlebars()`: The constructor function which holds the internal implementation on its `prototype`. This produces instance objects which store their configuration, `compiled` and `precompiled` templates, and expose an `engine()` function which can be registered with an IOPA app.

* `engine()`: A convenience factory function for creating `IopaHandlebars` instances.

An instance-based approach is used so that multiple `IopaHandlebars` instances can be created with their own configuration, templates, partials, and helpers.


## Installation

Install using npm:

```shell
$ npm install express-handlebars
```


## Usage

This view engine uses sane defaults that leverage the "IOPA-way" of structuring an app's views. This makes it trivial to use in basic apps:

### Basic Usage

**Directory Structure:**

```
.
├── app.js
└── views
    ├── home.hbs
    └── layouts
        └── main.hbs

2 directories, 3 files
```

**app.js:**

Creates a super simple IOPA app which shows the basic way to register a Handlebars view engine using this package.

```javascript
const iopa = require('iopa'),
    templates = require('iopa-templates'),
    handlebars = require('iopa-template-handlebars'),
    iopaConnect = require('iopa-connect'),
    http = require('http'),

var app = new iopa.App();
app.use(templates);
app.engine('.hbs', handlebars({defaultLayout: 'main', views: 'test/views'}));

app.use(function(context, next) {
    return context.render('home.hbs');
});

http.createServer(app.buildHttp()).listen(3000);
```

**views/layouts/main.handlebars:**

The main layout is the HTML page wrapper which can be reused for the different views of the app. `{{{body}}}` is used as a placeholder for where the main content should be rendered.

```handlebars
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Example App</title>
</head>
<body>

    {{{body}}}

</body>
</html>
```

**views/home.handlebars:**

The content for the app's home view which will be rendered into the layout's `{{{body}}}`.

```handlebars
<h1>Example App: Home</h1>
```

#### Running the Example

The above example is bundled in this package's `demo.js`, where it can be run by:

```shell
$ node demo
```

### Template Caching

This view engine uses a smart template caching strategy. In development, templates will always be loaded from disk, i.e., no caching. In production, raw files and compiled Handlebars templates are aggressively cached.

### Layouts

A layout is simply a Handlebars template with a `{{{body}}}` placeholder. Usually it will be an HTML page wrapper into which views will be rendered.

This view engine supports the concept of "layout".  It can be configured with a path to the layouts directory, by default it's set to `"views/layouts/"`.

The layout into which a view should be rendered can be overridden per-request by assigning a different value to the `layout` request local. The following will render the "home" view with no layout:

```javascript
app.get('/', function (context) {
    context.render('home', {layout: false});
});
```

### Helpers

Helper functions, or "helpers" are functions that can be [registered with Handlebars][] and can be called within a template. Helpers can be used for transforming output, iterating over data, etc. To keep with the spirit of *logic-less* templates, helpers are the place where logic should be defined.

Handlebars ships with some [built-in helpers][], such as: `with`, `if`, `each`, etc. Most application will need to extend this set of helpers to include app-specific logic and transformations. Beyond defining global helpers on `Handlebars`, this view engine supports `IopaHandlebars` instance-level helpers via the `helpers` configuration property, and render-level helpers via `options.helpers` when calling the `render()` and `renderView()` methods.

The following example shows helpers being specified at each level:

**app.js:**

Creates a super simple IOPA app which shows the basic way to register `IopaHandlebars` instance-level helpers, and override one at the render-level.

```javascript

const iopa = require('iopa'),
    templates = require('iopa-templates'),
    handlebars = require('./index.js'),
    http = require('http'),
    iopaConnect = require('iopa-connect')
    router = require('iopa-router'),
    helpers =  require('./test/advanced/lib/helpers');

var app = new iopa.App();
app.use(templates);
app.use(router);
app.engine('.hbs', handlebars({
    defaultLayout: 'main', 
    views: 'test/advanced/views',
    helpers      : helpers,
    partialsDir: [
        'shared/templates/',
        'views/partials/'
    ]}));
    
app.get('/', function (context) {
   return context.render('home', {
        title: 'Home'
    });
});

app.get('/yell', function (context) {
  return  context.render('yell', {
        title: 'Yell',

        // This `message` will be transformed by our `yell()` helper.
        message: 'hello world'
    });
});

app.get('/exclaim', function (context) {
   return context.render('yell', {
        title  : 'Exclaim',
        message: 'hello world',

        // This overrides _only_ the default `yell()` helper.
        helpers: {
            yell: function (msg) {
                return (msg + '!!!');
            }
        }
    });
});

var port = process.env.PORT || 3000;
http.createServer(app.buildHttp()).listen(port);
console.log('listening at:', port);
```

**views/home.handlebars:**

The app's home view which uses helper functions to help render the contents.

```handlebars
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Example App - Home</title>
</head>
<body>

    <!-- Uses built-in `if` helper. -->
  {{#if showTitle}}
    <h1>Home</h1>
  {{/if}}

    <!-- Calls `foo` helper, overridden at render-level. -->
    <p>{{foo}}</p>

    <!-- Calls `bar` helper, defined at instance-level. -->
    <p>{{bar}}</p>

</body>
</html>
```

#### More on Helpers

Refer to the [Handlebars website][] for more information on defining helpers:

* [Expression Helpers][]
* [Block Helpers][]

### Metadata

Handlebars has a data channel feature that propagates data through all scopes, including helpers and partials. Values in the data channel can be accessed via the `{{@variable}}` syntax. IOPA Handlebars provides metadata about a template it renders on a model object allowing access to things like the view name passed to `context.render()` 

The following is the list of metadata that's accessible on the data object:

* `cache`: Boolean whether or not the template is cached.
* `view`: String name of the view passed to `res.render()`.
* `layout`: String name of the layout view.
* `data`: Original data object passed when rendering the template.
* `helpers`: Collection of helpers used when rendering the template.
* `partials`: Collection of partials used when rendering the template.

[registered with Handlebars]: https://github.com/wycats/handlebars.js/#registering-helpers
[built-in helpers]: http://handlebarsjs.com/#builtins
[Handlebars website]: http://handlebarsjs.com/
[Expression Helpers]: http://handlebarsjs.com/expressions.html#helpers
[Block Helpers]: http://handlebarsjs.com/block_helpers.html

