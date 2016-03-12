/*
 * Copyright (c) 2016 Internet of Protocols Alliance (IOPA)
 * Portions  copyright (c) 2014, Yahoo Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var Handlebars = require('./lib/handlebars-v4.0.5.js');
var fs         = require('fs');
var path       = require('path');

var utils = require('./utils');

module.exports = IopaHandlebars;

function IopaHandlebars(config) {
    utils.assign(this, {
        handlebars     : Handlebars,
        extname        : '.hbs',
        views          : 'views',
        defaultLayout  : undefined,
        helpers        : undefined,
        compilerOptions: undefined,
    }, config);
    
    utils.assign(this, {
        layouts        : this.views + '/layouts/',
        partials       : this.views + '/partials/',
    }, config);

    this.engine = this.renderView.bind(this);

    if (this.extname.charAt(0) !== '.') {
        this.extname = '.' + this.extname;
    }

    this.compiled    = Object.create(null);
    this.precompiled = Object.create(null);

    this._fsCache = Object.create(null);
}

IopaHandlebars.prototype.getPartials = function (options) {
    var partials = Array.isArray(this.partials) ?
            this.partials : [this.partials];

    partials = partials.map(function (dir) {
        var dirPath;
        var dirTemplates;
        var dirNamespace;

        if (typeof dir === 'string') {
            dirPath = path.resolve(dir);
        } else if (typeof dir === 'object') {
            dirTemplates = dir.templates;
            dirNamespace = dir.namespace;
            dirPath      = dir.dir;
        }

        if (!(dirPath || dirTemplates)) {
            throw new Error('A partials dir must be a string or config object');
        }

        var templatesPromise = dirTemplates ? Promise.resolve(dirTemplates) :
                this.getTemplates(dirPath, options);

        return templatesPromise.then(function (templates) {
            return {
                templates: templates,
                namespace: dirNamespace,
            };
        });
    }, this);

    return Promise.all(partials).then(function (dirs) {
        var getTemplateName = this._getTemplateName.bind(this);

        return dirs.reduce(function (partials, dir) {
            var templates = dir.templates;
            var namespace = dir.namespace;
            var filePaths = Object.keys(templates);

            filePaths.forEach(function (filePath) {
                var partialName       = getTemplateName(filePath, namespace);
                partials[partialName] = templates[filePath];
            });

            return partials;
        }, {});
    }.bind(this));
};

IopaHandlebars.prototype.getTemplate = function (filePath, options) {
    filePath = path.resolve(filePath);
    options || (options = {});

    var precompiled = options.precompiled;
    var cache       = precompiled ? this.precompiled : this.compiled;
    var template    = options.cache && cache[filePath];

    if (template) {
        return template;
    }

   template = cache[filePath] = this._getFile(filePath, {cache: options.cache})
        .then(function (file) {
            if (precompiled) {
                return this._precompileTemplate(file, this.compilerOptions);
            }

            return this._compileTemplate(file, this.compilerOptions);
        }.bind(this));

    return template.catch(function (err) {
        delete cache[filePath];
        throw err;
    });
};

IopaHandlebars.prototype.getTemplates = function (dirPath, options) {
    options || (options = {});
    var cache = options.cache;

    return this._getDir(dirPath, {cache: cache}).then(function (filePaths) {
        var templates = filePaths.map(function (filePath) {
              var x = this.getTemplate(filePath, options);
              return x;
        }, this);

        return Promise.all(templates).then(function (templates) {
            return filePaths.reduce(function (hash, filePath, i) {
                hash[path.relative(dirPath, filePath)] = templates[i];
                return hash;
            }, {});
        });
    }.bind(this));
};

IopaHandlebars.prototype.render = function (filePath, context, options) {
    options || (options = {});

    return Promise.all([
        this.getTemplate(filePath, {cache: options.cache}),
        options.partials || this.getPartials({cache: options.cache}),
    ]).then(function (templates) {
        var template = templates[0];
        var partials = templates[1];
        var helpers  = options.helpers || this.helpers;

       var data = utils.assign({}, options.data, {
            "iopa.Templates": utils.assign({}, options, {
                filePath: filePath,
                helpers : helpers,
                partials: partials,
            }),
        });

        return this._renderTemplate(template, context, {
            data    : data,
            helpers : helpers,
            partials: partials,
        });
    }.bind(this));
};

IopaHandlebars.prototype.renderView = function (view, options, callback) {
    options || (options = {});
    
    options.partials = options.partials || null;
    
    var viewname, viewPath;
    var viewRoot = ( options.settings && options.settings.views) || this.views;
    var basePath = path.resolve(viewRoot);
    if (path.resolve( view ) == path.normalize( view ))
       {
           // absolute path
            viewPath = view;
            view = path.relative(basePath, viewPath)
       } else
       {
           // relative path
           viewPath = path.join(basePath, view );
       }
       
    viewname = this._getTemplateName(view);
    var context = options;
      
    var helpers = utils.assign({}, this.helpers, options.helpers);

    var partials = Promise.all([
        this.getPartials({cache: options.cache}),
        Promise.resolve(options.partials),
    ]).then(function (partials) {
        return utils.assign.apply(null, [{}].concat(partials));
    });

    options = {
        cache : options.cache,
        view  : viewname,
        layout: 'layout' in options ? options.layout : this.defaultLayout,
        data    : options.data,
        helpers : helpers,
        partials: partials,
    };

    this.render(viewPath, context, options)
        .then(function (body) {
            var layoutPath = this._resolveLayoutPath(options.layout);

            if (layoutPath) {
                return this.render(
                    layoutPath,
                    utils.assign({}, context, {body: body}),
                    utils.assign({}, options, {layout: undefined})
                );
            }

            return body;
        }.bind(this))
        .then(utils.passValue(callback))
        .catch(utils.passError(callback));
};

IopaHandlebars.prototype._compileTemplate = function (template, options) {
    return this.handlebars.compile(template, options);
};

IopaHandlebars.prototype._precompileTemplate = function (template, options) {
    return this.handlebars.precompile(template, options);
};

IopaHandlebars.prototype._renderTemplate = function (template, context, options) {
    return template(context, options);
};

IopaHandlebars.prototype._getDir = function (dirPath, options) {
    dirPath = path.resolve(dirPath);
    options || (options = {});

    var cache = this._fsCache;
    var dir   = options.cache && cache[dirPath];

    if (dir) {
        return dir.then(function (dir) {
            return dir.concat();
        });
    }
    
    var self = this;

    dir = cache[dirPath] = new Promise(function (resolve, reject) {
        utils.walkSubFolders(dirPath, self.extname, function (err, dir) {
            if (err) {
                reject(err);
            } else {
                resolve(dir);
            }
        });
    });

    return dir.then(function (dir) {
        return dir.concat();
    }).catch(function (err) {
        delete cache[dirPath];
        return [];
    });
};

IopaHandlebars.prototype._getFile = function (filePath, options) {
    filePath = path.resolve(filePath);
    options || (options = {});

    var cache = this._fsCache;
    var file  = options.cache && cache[filePath];

    if (file) {
        return file;
    }

    file = cache[filePath] = new Promise(function (resolve, reject) {
          
        fs.readFile(filePath, 'utf8', function (err, file) {
            if (err) {
                reject(err);
            } else {
                resolve(file);
            }
        });
    });

    return file.catch(function (err) {
        delete cache[filePath];
        throw err;
    });
};

IopaHandlebars.prototype._getTemplateName = function (filePath, namespace) {
    var extRegex = new RegExp(this.extname + '$');
    var name     = filePath.replace(extRegex, '');

    if (namespace) {
        name = namespace + '/' + name;
    }

    return name;
};

IopaHandlebars.prototype._resolveLayoutPath = function (layoutPath) {
    if (!layoutPath) {
        return null;
    }

    if (!path.extname(layoutPath)) {
        layoutPath += this.extname;
    }

    return path.resolve(this.layouts, layoutPath);
};
