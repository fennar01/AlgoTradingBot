const API_KEY = "But thats a secret!";
const SECRET_KEY = "Not today";

const url = "wss://stream.data.alpaca.markets/v1beta1/crypto";
const socket = new WebSocket(url);

const auth = { action: "auth", key: API_KEY, secret: SECRET_KEY };
const subscribe = {
  action: "subscribe",
  trades: ["ETHUSD"],
  quotes: ["ETHUSD"],
  bars: ["ETHUSD"],
};

const quotesElement = document.getElementById("quotes");
const tradesElement = document.getElementById("trades");
const openOrdersElement = document.getElementById("open_orders");
const closedOrdersElement = document.getElementById("closed_orders");

let currentBar = {};
let trades = [];

var chart = LightweightCharts.createChart(document.getElementById("chart"), {
  width: 500,
  height: 665,
  layout: {
    backgroundColor: "#000000",
    textColor: "#ffffff",
  },
  grid: {
    vertLines: {
      color: "#404040",
    },
    horzLines: {
      color: "#404040",
    },
  },
  crosshair: {
    mode: LightweightCharts.CrosshairMode.Normal,
  },
  priceScale: {
    borderColor: "#cccccc",
  },
  timeScale: {
    borderColor: "#cccccc",
    timeVisible: true,
  },
});

var candleSeries = chart.addCandlestickSeries();

var start = new Date(Date.now() - 7200 * 1000).toISOString();

console.log(start);

var bars_url =
  "https://data.alpaca.markets/v1beta1/crypto/ETHUSD/bars?exchanges=CBSE&timeframe=1Min&start=" +
  start;

fetch(bars_url, {
  headers: {
    "APCA-API-KEY-ID": API_KEY,
    "APCA-API-SECRET-KEY": SECRET_KEY,
  },
})
  .then((r) => r.json())
  .then((response) => {
    console.log(response);

    const data = response.bars.map((bar) => ({
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      time: Date.parse(bar.t) / 1000,
    }));

    currentBar = data[data.length - 1];

    console.log(data);

    candleSeries.setData(data);
  });

socket.onmessage = function (event) {
  const data = JSON.parse(event.data);
  const message = data[0]["msg"];

  if (message == "connected") {
    console.log("do authentication");
    socket.send(JSON.stringify(auth));
  }

  if (message == "authenticated") {
    socket.send(JSON.stringify(subscribe));
  }

  for (var key in data) {
    const type = data[key].T;

    if (type == "q") {
      //console.log('got a quote');
      //console.log(data[key]);

      const quoteElement = document.createElement("div");
      quoteElement.className = "quote";
      quoteElement.innerHTML = `<b>${data[key].t}</b> ${data[key].bp} ${data[key].ap}`;
      quotesElement.appendChild(quoteElement);

      var elements = document.getElementsByClassName("quote");
      if (elements.length > 5) {
        quotesElement.removeChild(elements[0]);
      }
    }

    if (type == "t") {
      //console.log('got a trade');
      //console.log(data[key]);

      const tradeElement = document.createElement("div");
      tradeElement.className = "trade";
      tradeElement.innerHTML = `<b>${data[key].t}</b> ${data[key].p} ${data[key].s}`;
      tradesElement.appendChild(tradeElement);

      var elements = document.getElementsByClassName("trade");
      if (elements.length > 5) {
        tradesElement.removeChild(elements[0]);
      }

      trades.push(data[key].p);

      var open = trades[0];
      var high = Math.max(...trades);
      var low = Math.min(...trades);
      var close = trades[trades.length - 1];

      //console.log(open, high, low, close);

      candleSeries.update({
        time: currentBar.time + 60,
        open: open,
        high: high,
        low: low,
        close: close,
      });
    }

    if (type == "b" && data[key].x == "CBSE") {
      //console.log('got a new bar');
      //console.log(data[key]);

      var bar = data[key];
      var timestamp = new Date(bar.t).getTime() / 1000;

      currentBar = {
        time: timestamp,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
      };

      candleSeries.update(currentBar);

      trades = [];
    }
  }
};

var priceLines = [];

// connect to websocket server
const orderSocket = new WebSocket("ws://localhost:9001");

orderSocket.onopen = function (data) {
  //orderSocket.send('ui');
};

orderSocket.onmessage = function (event) {
  console.log("received message from server");
  console.log(event.data);
  try {
    // clear pricelines and open orders
    priceLines.forEach((priceLine) => {
      candleSeries.removePriceLine(priceLine);
    });
    openOrdersElement.innerHTML = "";

    // add pricelines and open orders to UI
    let orderData = JSON.parse(event.data);

    orderData.forEach((order) => {
      console.log(order);
      // create an HTML div element for the order if one doesn't exist
      var orderElement = document.getElementById(order.id);
      if (!orderElement) {
        orderElement = document.createElement("div");
        orderElement.innerHTML = `<div id="${order.id}" class="${order.side}">${order.side} ${order.price} ${order.status}</div>`;
      }

      if (order.status == "closed") {
        closedOrdersElement.appendChild(orderElement);
      } else {
        openOrdersElement.appendChild(orderElement);

        // create priceline for the chart for open orders
        var priceLine = {
          price: order.price,
          color: order.side == "buy" ? "#00ff00" : "#ff0000",
          lineWidth: 2,
          lineStyle: LightweightCharts.LineStyle.Solid,
          axisLabelVisible: true,
          title: order.side,
        };
        console.log(priceLine);
        var line = candleSeries.createPriceLine(priceLine);
        priceLines.push(line);
      }
    });
  } catch (error) {
    console.log(error);
  }
};
