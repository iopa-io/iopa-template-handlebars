/*
 * Copyright (c) 2016 Internet of Protocols Alliance (IOPA)
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

/*
 * DEPENDENCIES
 *     note: npm include 'bluebird' if no Promise object exists
 */
global.Promise = global.Promise || require('bluebird');

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
