function hslToRgb(h, s, l){
    var r, g, b;

    if(s == 0){
        r = g = b = l; // achromatic
    }else{
        function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rint (min, max) {
  return Math.floor(Math.random() * (max-min)) + min;
}

function Market (nTraders, startWealth, wealthRate, incomeRate) {
  var wealth = [];
  var income = [];
  var skill = [];
  var wealthRate = typeof(wealthRate)==='number'? wealthRate : 0;
  var incomeRate = typeof(incomeRate)==='number'? incomeRate : 0;

  for (var i=0; i < nTraders; i++) {
    wealth.push(startWealth);
    income.push(0);
    skill.push(1);
  }

  var trade = function (t1, t2, amt) {
    income[t1] += amt;
    income[t2] -= amt;
  };

  var gini = function (array) {
    var N = array.length;

    // Copy array
    var mean=0, sum=0;
    var i = N;
    var sorted = [];
    while (i--) { sorted[i] = array[i]; }

    // Calculate Gini using Jasso/Deaton formula
    // 1. Reverse sort array (richest first)
    sorted.sort(function (a,b) { return (b-a); });

    for (i=1; i <= N; i++) {
      mean += Math.max(0, sorted[i-1]);
      sum += i * Math.max(0, sorted[i-1]);
    }

    return (N+1.0)/(N-1.0) - (2.0*sum)/(mean*(N-1));
  };

  this.evolve = function (nTrades, tradeAmount) {
    var i, t1, t2, pSuccess, tax;
    var taxPot = 0;
    var totalWealth = 0;
    var maxWealth = 0;
    var richest;

    // Reset income and collect wealth tax
    for (i=0; i < nTraders; i++) {
      income[i] = 0;

      tax = wealthRate * wealth[i];
      taxPot += tax;
      wealth[i] -= tax;
    }

    for (i=0; i < nTrades; i++) {
      // Choose two traders at random
      t1 = rint(0, nTraders);
      t2 = rint(0, nTraders); 

      // Trade if both parties have funds
      if (wealth[t1] > 0 && wealth[t2] > 0) {
        pSuccess = skill[t1] / (skill[t1] + skill[t2]);
        if (pSuccess > Math.random()) {
          trade(t1, t2, tradeAmount);
        } else {
          trade(t2, t1, tradeAmount);
        }
      }
    }

    // Collect income tax
    for (i=0; i < nTraders; i++) {
      tax = incomeRate * Math.max(0, income[i]);
      taxPot += tax;
      income[i] -= tax;
    }

    for (i=0; i < nTraders; i++) {
      // Pay out universal income
      income[i] += taxPot/nTraders;
      wealth[i] += income[i];
    }

    for (i=0; i < nTraders; i++) {
      totalWealth += wealth[i];
      if (wealth[i] > maxWealth) {
        maxWealth = wealth[i];
        richest = i;
      } 
    }

    return [totalWealth, taxPot, maxWealth, richest];
  };

  this.wealthGini = function () { return gini(wealth); };
  this.incomeGini = function () { return gini(income); };
  this.getWealth = function (t) { return wealth[t]; };
}

function Parameters () {
  this.nTraders = 100;
  this.startWealth = 100000;
  this.nTrades = 1000;
  this.tradeAmount = 1000;
  this.wealthRate = 0.0;
  this.incomeRate = 0.1;

  this.fromHTML = function () {
    var input;
    for (k in this) {
      if (k === 'toHTML' || k === 'fromHTML') continue;
      input = document.getElementById(k);
      this[k] = parseFloat(input.value);
      console.log("Read", k, input.value, this[k]);
    }
  };

  this.toHTML = function (form) {
    var input, label;
    for (k in this) {
      if (k === 'toHTML' || k === 'fromHTML') continue;
      label = document.createElement('label');
      label.setAttribute('for', k);
      label.innerHTML = k;

      input = document.createElement('input');
      input.setAttribute('type', 'number');
      input.setAttribute('id', k);
      input.setAttribute('value', this[k]);

      form.appendChild(label);
      form.appendChild(input);
    }
  };
}

function Simulation (params) {
  var p = params;
  var year, gdp, oldGdp, gdpGrowth, wGini, iGini, maxWealth, richest;

  var market;

  var start = null;
  var pad = 20;

  var canvas, ctx, spanWealth, spanIncome, spanYear, spanTotal, spanTax, spanMax;
  var len, nside, offx, offy;

  this.resizeCanvas = function () {
    if (canvas.getContext) {
      var divCanvas = document.getElementById('container');
      var w = divCanvas.offsetWidth;
      var h = divCanvas.offsetHeight;
      var min = Math.min(w, h);
      var max = Math.max(w, h);
      var offs = Math.floor((max - min)/2.0);
      ctx = canvas.getContext('2d');
      nside = Math.ceil( Math.sqrt(p.nTraders) );
      len = Math.floor((min - (nside+1)*pad) / nside);
      offx = (canvas.offsetWidth > canvas.offsetHeight)? offs:0;
      offy = (canvas.offsetHeight > canvas.offsetWidth)? offs:0;
      canvas.width = w;
      canvas.height = h;
    }
  }

  var updateCanvas = function () {
    if (canvas.getContext) {
      var x, y, normWealth, rgb;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (var s=0; s < p.nTraders; s++) {
        x = offx + pad + (s%nside)*(len+pad);
        y = offy + pad + Math.floor(s/nside)*(len+pad);
        normWealth = (Math.max(market.getWealth(s), 0) / maxWealth) * 0.6;
        rgb = hslToRgb(normWealth, 1, 0.5);
        ctx.fillStyle = 'rgb('+rgb[0]+','+rgb[1]+','+rgb[2]+')';
        ctx.fillRect(x, y, len, len);
        if (s === richest) {
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, len, len);
        }
      }
    }
  }

  this.prepPage = function () {
    canvas = document.getElementById('marketplace');
    spanWealth = document.getElementById('infoWGini');
    spanIncome = document.getElementById('infoIGini');
    spanYear = document.getElementById('infoYear');
    spanTotal = document.getElementById('infoTotal');
    spanTax = document.getElementById('infoTax');
    spanMax = document.getElementById('infoMax');
  }

  this.reset = function () {
    year = 0;
    start = null;

    if (spanWealth) {
      spanWealth.innerHTML = '-';
      spanIncome.innerHTML = '-';
      spanYear.innerHTML = '-';
      spanTotal.innerHTML = '-';
      spanTax.innerHTML = '-';
      spanMax.innerHTML = '-';
    }

    market = new Market(p.nTraders, p.startWealth, p.wealthRate, p.incomeRate);
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  this.update = function (time) {
    if (!start) start = time;

    if (time - start > 10) {
      out = market.evolve(p.nTrades, p.tradeAmount);
      var totalWealth = out[0];
      var taxPot = out[1];
      maxWealth = out[2];
      richest = out[3];

      if (year > 0) {
        wGini = market.wealthGini();
        iGini = market.incomeGini();

        wGini = wGini < 1e-3? 0 : wGini;
        iGini = iGini < 1e-3? 0 : iGini;

        spanYear.innerHTML = ''+year;
        spanWealth.innerHTML = ''+wGini.toPrecision(2);
        spanIncome.innerHTML = ''+iGini.toPrecision(2);
        spanTotal.innerHTML = ''+totalWealth.toPrecision(2);
        spanTax.innerHTML = ''+taxPot.toPrecision(2);
        spanMax.innerHTML = (maxWealth/totalWealth).toPrecision(2)+'%';
      }
      year++;
      updateCanvas();

      start = time;
    }
  }

  this.reset();
}

var running = false;
var params = new Parameters();
var sim = new Simulation(params);
var form;
var startButton;

function animate (time) { 
  if (running) sim.update(time);
  window.requestAnimationFrame(animate);
}

function startClick () {
  running = !running;
  startButton.innerHTML = running? 'Pause' : 'Start';
}

function resetClick () {
  running = false;
  startButton.innerHTML = 'Start';
  params.fromHTML();
  sim.reset();
  sim.resizeCanvas();
}

function setup () {
  startButton = document.createElement('button');
  startButton.innerHTML = "Start";
  startButton.addEventListener('click', startClick);

  resetButton = document.createElement('button');
  resetButton.innerHTML = "Reset";
  resetButton.addEventListener('click', resetClick);

  var divBtns = document.getElementById('buttons');
  divBtns.appendChild(startButton);
  divBtns.appendChild(resetButton);

  form = document.getElementById('settingsForm');

  var inputs = form.getElementsByTagName('input');

  for (var i=0; i<inputs.length; i++) {
    cv = inputs[i];
    cv.addEventListener('input', resetClick);
  }

  sim.prepPage();
  params.toHTML(form);
  sim.resizeCanvas();
  window.requestAnimationFrame(animate);
}

window.onload = setup;
window.onresize = sim.resizeCanvas;
