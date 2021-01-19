const port = 5000;
const url = "http://localhost";
const CATALOG_URL = url + ":" + port + "/Catalog?";
const LIST_URL = url + ":" + port + "/List?id=";
const QUOTE_URL = url + ":" + port + "/Quote?id=";
const CART_URL = url + ":" + port + "/Cart?";
// a history list of views displayed
var historyView = [];

function hideAll() {
	let list = document.getElementsByClassName("view");
	for (let e of list) {
		e.style.display = "none";
	}
}

function doAjax(address, handler) {
	var http = new XMLHttpRequest();
	http.onreadystatechange = function () {
		if (http.readyState == 4 && http.status == 200) {
			handler(http.responseText);
		}
	};
	http.open("GET", address, true);
	http.send();
}

// display needed view and hide all other views
function show(v, param) {
	hideAll();
	let div = document.getElementById(v);
	div.style.display = "block";
	document.getElementById("backButton").style.display = "inline";

	// record current view id, if current view = previous view, remove the duplicate
	historyView.push(v);
	if (historyView.length > 1 && historyView[historyView.length - 2] == v) {
		historyView.pop();
	}

	if (v == "catalogView") {
		historyView = ["catalogView"];
		document.getElementById("backButton").style.display = "none";
		doAjax(CATALOG_URL, catalogPopulate);
	} else if (v == "categoryView") {
		document.getElementById("categoryTitle").innerText =
			"Category: " + param.categoryName;
		doAjax(LIST_URL + param.categoryId, categoryPopulate);
	} else if (v == "productView") {
		doAjax(QUOTE_URL + param.productId, productPopulate);
	} else if (v == "cartView") {
		if (param) {
			doAjax(CART_URL + "item=" + JSON.stringify(param), cartPopulate);
		} else {
			doAjax(CART_URL, cartPopulate);
		}
	}
}

function addToCart() {
	let name = document.getElementById("product_name").innerText;
	let id = document.getElementById("product_id").innerText;
	let price = document.getElementById("product_price").innerText;
	price = price.substring(price.indexOf(" ") + 1);
	show("cartView", {
		name: name,
		id: id,
		price: price,
		qty: 1,
	});
}

function updateItemInCart(name, id, price) {
	let data = document.getElementById(id + "_qty");
	let cur_qty = data.value;
	let pre_qty = data.placeholder;
	let increment = cur_qty - pre_qty;
	show("cartView", {
		name: name,
		id: id,
		price: price,
		qty: increment,
	});
}

// Given the backButton is clicked, back to previous view
function back() {
	let cur_view = document.getElementById(historyView.pop());
	let pre_view = document.getElementById(historyView[historyView.length - 1]);
	if (pre_view.getAttribute("id") == "catalogView") {
		document.getElementById("backButton").style.display = "none";
	}
	pre_view.style.display = "block";
	cur_view.style.display = "none";
}

function catalogPopulate(res) {
	let ar = JSON.parse(res);
	let div = document.getElementById("catalogList");
	div.innerHTML = "";
	let a;
	ar.forEach((e, i) => {
		a = document.createElement("a");
		a.onclick = function () {
			show("categoryView", {
				categoryName: e.name,
				categoryId: e.id,
			});
		};
		a.className = "list-group-item list-group-item-action";
		a.innerText = e.name;
		div.appendChild(a);
	});
}

function categoryPopulate(res) {
	let ar = JSON.parse(res);
	let div = document.getElementById("categoryList");
	div.innerHTML = "";
	let a;
	ar.forEach((e, i) => {
		a = document.createElement("a");
		a.onclick = function () {
			show("productView", {
				productId: e.id,
			});
		};
		a.className = "list-group-item list-group-item-action";
		a.innerText = e.name;
		div.appendChild(a);
	});
}

function productPopulate(res) {
	let product = JSON.parse(res)[0];
	let div = document.getElementById("productInfo");
	div.innerHTML = "";

	let sub_div = document.createElement("div");
	sub_div.className = "card-body";
	div.appendChild(sub_div);

	let header = document.createElement("h2");
	header.className = "card-title font-weight-lighter";
	header.id = "product_name";
	header.innerText = product.name;
	sub_div.appendChild(header);

	let span = document.createElement("span");
	span.id = "product_id";
	span.innerText = product.id;
	span.style.display = "none";
	sub_div.appendChild(span);

	let sub_header = document.createElement("h3");
	sub_header.className =
		"card-subtitle mt-2 mb-3 text-muted font-weight-bold";
	sub_header.innerHTML = "Price: " + product.msrp;
	sub_header.id = "product_price";
	sub_div.appendChild(sub_header);

	let text = document.createElement("p");
	text.className = "card-text";
	text.innerHTML = product.description;
	sub_div.appendChild(text);
}

function cartPopulate(res) {
	let items = JSON.parse(res);
	if (items.length == 0) {
		document.getElementById("cartSection").style.display = "none";
		document.getElementById("emptyTitle").style.display = "block";
	} else {
		document.getElementById("cartSection").style.display = "block";
		document.getElementById("emptyTitle").style.display = "none";
	}
	let table = document.getElementById("cartTable");
	table.innerHTML = "";
	let sub_total = 0;
	let count = 0;
	for (let item of items) {
		let row = document.createElement("tr");
		// item name column
		let header = document.createElement("th");
		header.scope = "row";
		header.innerHTML = item.name;
		row.appendChild(header);

		// item quantity column
		let input = document.createElement("input");
		input.type = "number";
		input.className = "form-control form-control-sm";
		input.id = item.id + "_qty";
		input.placeholder = item.qty;
		input.value = item.qty;
		let btn = document.createElement("button");
		btn.className = "btn btn-primary";
		btn.onclick = function () {
			updateItemInCart(item.name, item.id, item.price);
		};
		btn.innerHTML = "Update";
		let data = document.createElement("td");
		let div = document.createElement("div");
		div.className = "d-inline-flex";
		div.appendChild(input);
		div.appendChild(btn);
		data.appendChild(div);
		row.appendChild(data);

		// item price column
		data = document.createElement("td");
		data.innerHTML = item.price;
		row.appendChild(data);

		// item total price column
		data = document.createElement("td");
		data.innerHTML = (item.price * item.qty).toFixed(2);
		row.appendChild(data);

		table.appendChild(row);
		sub_total += item.price * item.qty;
		count += item.qty;
	}
	document.getElementById("subtotal").innerText = sub_total.toFixed(2);
	document.getElementById("itemCount").innerText = count;
}
