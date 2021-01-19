const port = 65000;
// const home = require('os').homedir;
// const DB_PATH = home + '/4413/pkg/sqlite/Models_R_US.db';
const DB_PATH = "./sqlite/Models_R_US.db";
const GCP_KEY = "AIzaSyBKfzDUkQK111j6lj1UV_fgAEV64IKSxdA";

const net = require("net");
const https = require("https");
const express = require("express");
const session = require("express-session");

var app = express();
var sqlite3 = require("sqlite3").verbose();
var db = new sqlite3.Database(DB_PATH);
app.enable("trust proxy");

// Testing middleware for url mapping route:  http://host:port/Test?x=123
app.use("/Test", function (req, res) {
	res.writeHead(200, {
		"Content-Type": "text/html",
	});
	res.write("Hello ... this is EECS4413/Fall19 Tester! ");
	res.end("You sent me: " + req.query.x);
});

app.use(
	session({
		secret: "mine",
		proxy: true,
		resave: true,
		saveUninitialized: true,
	})
);

app.use((req, res, next) => {
	res.header("Access-Control-Allow-Credentials", true);
	res.header("Access-Control-Allow-Origin", req.headers.origin);
	next();
});

// http://localhost:8000/GeoNode?lat=43.759313&lon=-79.409071
// http://localhost:8000/GeoNode?lat=43.759878&lon=-79.406491
app.use("/GeoNode", function (req, res) {
	let sess = req.session;
	let lat = req.query.lat;
	let lon = req.query.lon;

	if (!lat || lat == "" || !lon || lon == "") {
		res.status(400)
			.json({
				error: 400,
				message: "Please specify the latitude/lontitude",
			})
			.end();
		return;
	}

	if (!sess.lat) {
		// fresh request
		sess.lat = lat;
		sess.lon = lon;
		res.writeHead(200, {
			"Content-Type": "text/plain",
		});
		res.end("RECEIVED");
		return;
	}

	let pre_lat = sess.lat;
	let pre_lon = sess.lon;
	let query = pre_lat + " " + pre_lon + " " + lat + " " + lon + "\n";
	let response = "";
	let hasErr;

	// service discovery
	let fs = require("fs");
	let contents;
	try {
		contents = fs
			.readFileSync(home + "/4413/ctrl/Geo")
			.toString()
			.trim();
	} catch (error) {
		console.log(error);
		res.status(500)
			.json({
				error: 500,
				message: "Internal Server Error",
			})
			.end();
		return;
	}

	// query service via TCP connection
	var opt = {
		host: contents.substring(0, contents.indexOf(" ")),
		port: contents.substring(contents.indexOf(" ") + 1),
	};
	var client = net.createConnection(opt, () => {
		console.log("connected to Geo :)");
		// Send a request
		client.write(query);
		// close the socket
		client.end();
	});
	// Listen for response or error
	client.on("data", (data) => {
		response += data.toString();
	});
	client.on("error", (err) => {
		console.log(err);
		hasErr = true;
	});
	client.on("close", () => {
		if (hasErr) {
			res.status(500)
				.json({
					error: 500,
					message: "Internal Server Error",
				})
				.end();
		} else {
			if (!response.startsWith("Do not understand")) {
				response =
					"The distance from (" +
					pre_lat +
					"," +
					pre_lon +
					") to (" +
					lat +
					"," +
					lon +
					") is " +
					response.trim();
				// reset attributes stored in session to currently received values
				sess.lat = lat;
				sess.lon = lon;
				res.writeHead(200, {
					"Content-Type": "text/plain",
				});
				res.end(response);
			} else {
				// reset attributes stored in session to null since either session or current
				// coordinate is invalid
				sess.lat = null;
				sess.lon = null;
				res.status(400)
					.json({
						error: 400,
						message: "Please provide valid coordinates",
					})
					.end();
			}
		}
	});
});

app.use("/Catalog", function (req, res) {
	let id = req.query.id;
	let query;
	if (!id || id == "") {
		// query all rows in db
		query = "select * from Category";
	} else {
		query = "select * from Category where id = " + id;
	}
	// given a query
	db.all(query, function (err, rows) {
		if (err == null) {
			res.json(rows).end();
		} else {
			console.log(err);
			res.status(500)
				.json({
					error: 500,
					message: "Internal Server Error",
				})
				.end();
		}
	});
});

// http://localhost:8000/Trip?from=15%20Greenview%20Ave&to=4700%20keele%20street
app.use("/Trip", function (req, res) {
	let from = req.query.from;
	let to = req.query.to;
	let url;
	if (!from || !to || from == "" || to == "") {
		res.status(400)
			.json({
				error: 400,
				message: "Please specify the 'from'/'to' addresses",
			})
			.end();
		return;
	}

	url =
		"https://maps.googleapis.com/maps/api/distancematrix/json?origins=" +
		from +
		"&destinations=" +
		to +
		"&departure_time=now&key=" +
		GCP_KEY;

	// query google map api via HTTPS GET
	https
		.get(url, (resp) => {
			let data = "";
			resp.on("data", (x) => {
				data += x;
			});
			resp.on("end", () => {
				let data_json = JSON.parse(data);
				let status = data_json.rows[0].elements[0].status;
				let result;
				if (status == "OK") {
					result = {
						status: status,
						optimal_distance:
							data_json.rows[0].elements[0].distance.text,
						optimal_time:
							data_json.rows[0].elements[0].duration_in_traffic
								.text,
					};
				} else {
					result = {
						status: status,
						optimal_distance: "",
						optimal_time: "",
					};
				}
				res.json(result).end();
			});
		})
		.on("error", (err) => {
			console.log(err);
			res.status(500)
				.json({
					error: 500,
					message: "Internal Server Error",
				})
				.end();
		});
});

// --------------------------------------- ProjD ---------------------------------------

app.use("/Static", express.static("./static"));

app.use("/List", (req, res) => {
	let id = req.query.id;
	let query = "select id, name from Product where catid = ?";
	db.all(query, [id], (err, rows) => {
		if (err == null) {
			res.write(JSON.stringify(rows));
			res.end();
		} else {
			console.log(err);
			res.status(500)
				.json({
					error: 500,
					message: "Internal Server Error",
				})
				.end();
		}
	});
});

app.use("/Quote", (req, res) => {
	let id = req.query.id;
	let query = "select id, name, description, msrp from Product where id = ?";
	db.all(query, [id], (err, rows) => {
		if (err == null) {
			res.write(JSON.stringify(rows));
			res.end();
		} else {
			console.log(err);
			res.status(500)
				.json({
					error: 500,
					message: "Internal Server Error",
				})
				.end();
		}
	});
});

// app.use("/ClearCart", (req, res) => {
//     let sess = req.session;
//     sess.cart = [];
//     res.end(JSON.stringify(sess.cart));
// });

app.use("/Cart", (req, res) => {
	// client sends item as {"id":"S50_1514", "qty":"1", "price":58.58}
	let sess = req.session;
	let item;
	if (!sess.cart) {
		sess.cart = [];
	}
	if (req.query.item) {
		item = JSON.parse(req.query.item);
		let found = false;
		for (let i = 0; i < sess.cart.length; i++) {
			if (sess.cart[i].id == item.id) {
				found = true;
				sess.cart[i].qty += item.qty;
				if (sess.cart[i].qty <= 0) {
					sess.cart.splice(i, 1);
				}
				break;
			}
		}
		if (!found) {
			sess.cart.push(item);
		}
	}
	console.log(sess.id);
	console.log(sess.cart);
	res.end(JSON.stringify(sess.cart));
});

// --------------------------------------SERVER
var server = app.listen(port, function () {
	var host = server.address().address;
	var port = server.address().port;
	console.log("Listening at http://%s:%d", host, port);
});
