var http = require("http");
var express = require("express");
var consolidate = require("consolidate");
var _ = require("underscore");
var bodyParser = require('body-parser');

var routes = require('./routes'); //File that contains our endpoints
var mongoClient = require("mongodb").MongoClient;

var app = express();
app.use(bodyParser.urlencoded({
    extended: true,
}));

app.use(bodyParser.json({
    limit: '5mb'
}));

app.set('views', 'views');
app.use(express.static('./public'));
app.set('view engine', 'html');
app.engine('html', consolidate.underscore);

var server = http.Server(app);
var portNumber = 8000;

var io = require('socket.io')(server); //new socket.io instance

server.listen(portNumber, function() {
    console.log('Server listening at port ' + portNumber);

    var url = 'mongodb://localhost:27017/myHelpApp'; //Db name
    mongoClient.connect(url, function(err, db) {
        console.log("Connected to Database"+url);

        app.get('/citizen.html', function(req, res) {
            res.render('citizen.html', {
                userId: req.query.userId
            });
        });

        app.get('/cop.html', function(req, res) {
            res.render('cop.html', {
                userId: req.query.userId
            });
        });

        app.get('/data.html', function(req, res) {
            res.render('data.html');
        });

        io.on('connection', function(socket) { //Listen connection
            console.log('A user just connected');

            socket.on('join', function(data) { //Listen to any join event
                socket.join(data.userId);
                console.log("User joined room: " + data.userId);
            });

            routes.initialize(app, db, socket, io);
        });
    });
});
