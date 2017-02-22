var dbOperations = require('./db-operations');

function initialize(app, db, socket, io) {
    app.get('/cops', function(req, res) {

        var latitude = Number(req.query.lat);
        var longitude = Number(req.query.lng);
        dbOperations.fetchNearestCops(db, [longitude, latitude], function(results) {
            res.json({
                cops: results
            });
        });
    });

    app.get('/cops/info', function(req, res) {
        var userId = req.query.userId //extract userId from query
        dbOperations.fetchCopDetails(db, userId, function(results) {
            res.json({
                copDetails: results
            });
        });
    });

    //Listen to a request
    socket.on('request-for-help', function(eventData) {

        var requestTime = new Date();

        var ObjectID = require('mongodb').ObjectID;
        var requestId = new ObjectID;

        var location = {
            coordinates: [
                eventData.location.longitude,
                eventData.location.latitude
            ],
            address: eventData.location.address
        };
        dbOperations.saveRequest(db, requestId, requestTime, location, eventData.citizenId, 'waiting', function(results) {

            dbOperations.fetchNearestCops(db, location.coordinates, function(results) {
                eventData.requestId = requestId;
                for (var i = 0; i < results.length; i++) {
                    io.sockets.in(results[i].userId).emit('request-for-help', eventData);
                }
            });
        });
    });

    socket.on('request-accepted', function(eventData) {
        console.log(eventData);
        var ObjectID = require('mongodb').ObjectID;
        var requestId = new ObjectID(eventData.requestDetails.requestId);

        dbOperations.updateRequest(db, requestId, eventData.copDetails.copId, 'engaged', function(results) {
            io.sockets.in(eventData.requestDetails.citizenId).emit('request-accepted', eventData.copDetails);
        })

    });

    //Fetch all requests
    app.get('/requests/info', function(req, res) {
        dbOperations.fetchRequests(db, function(results) {
            var features = [];
            for (var i = 0; i < results.length; i++) {
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: results[i].location.coordinates
                    },
                    properties: {
                        status: results[i].status,
                        requestTime: results[i].requestTime,
                        address: results[i].location.address
                    }
                })
            }
            var geoJsonData = {
                type: 'FeatureCollection',
                features: features
            }

            res.json(geoJsonData);
        });
    });

}

exports.initialize = initialize;
