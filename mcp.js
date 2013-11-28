var app           = require('http').createServer(handler),
  io              = require('socket.io').listen(app),
  fs              = require('fs'),
  Mcp             = require('mcp3008.js'),
  adc             = new Mcp(),
  gpio            = require('rpi-gpio'),
  IO_TYPE_NONE    = 'none',
  IO_TYPE_READ    = 'read',
  IO_TYPE_WRITE   = 'write',
  IO_TYPE_PWM     = 'pwm',
  PI_BLASTER_PATH = "/dev/pi-blaster",
  host            = 'localhost',
  port            = 3001,
  pins            = []


app.listen(port)

function handler (req, res) {
  host = req.headers.host
  switch (req.url) {
    case '/' :
      sendFile('index.html', res)
      break
    case '/client.js' :
      sendFile('client.js', res)
      break
    case '/style.css' :
      sendFile('style.css', res)
  }
}

var clients = []
  currentPin = -1,
  currentAdc = -1

setInterval(function() {
  if (!clients.length)  return
  pins.forEach(function(pin) {
    if (pin.ioType != IO_TYPE_READ) return
    readOverflow++
    gpio.read(pin.channel, function(err, value) {
      readOverflow--
      if (value == pin.value) return
      console.log('READ [' + pin.channel + ']: ' + pin.value)
      pin.value = value
      clients.forEach(function(client) {
        client.emit('read', {channel: pin.channel, value: pin.value})      
      })
    })
  })
}, 5);

io.sockets.on('connection', function (socket) {
  
  clients.push(socket)
  var id = clients.length - 1
  console.log('[' + id + '] connected')
  socket.on('disconnect', function() {
    id = clients.indexOf(socket)
    console.log('[' + id + '] disconnected')
    clients.splice(id, 1) 
  })

  socket.on('typeChanged', function(pin) {
    pins[pin.channel] = pin
    if (pin.ioType != IO_TYPE_PWM) setPwm('release ' + pin.gpio)
    if (pin.ioType == IO_TYPE_READ) {
      gpio.setup(pin.channel, gpio.DIR_IN, function(err) {
        if (err) throw err
        var p = pins[pin.channel]
        if (p.ioType == IO_TYPE_READ) {
          console.log('[' + p.channel + '] set to READ')
          gpio.read(p.channel, function(err, value) {
            p.value = value
            socket.emit('read', {channel: p.channel, value: value})
          })
        }
      })
    } else if (pin.ioType == IO_TYPE_WRITE) {
      pin.canWrite = false
      gpio.setup(pin.channel, gpio.DIR_OUT, function() {
        var p = pins[pin.channel]
        p.canWrite = true
        gpio.write(p.channel, p.value)
      })
    }
  })

  socket.on('write', function(pin) {
    if (pins[pin.channel] && pins[pin.channel].ioType == IO_TYPE_WRITE) {
      if (pins[pin.channel].canWrite) gpio.write(pin.channel, pin.value)
      else pins[pin.channel].value = pin.value
    } else {
      pins[pin.channel] = pin
      pin.canWrite = false
      pin.cachedValue = pin.value
      setPwm('release ' + pin.gpio)
      gpio.setup(pin.channel, gpio.DIR_OUT, function() {
        var p = pins[pin.channel]
        gpio.write(p.channel, p.value)
      })
    }
  })

  socket.on('pwm', function(pin) {
    console.log('pwm['+pin.channel+'] ' + pin.value)
    setPwm(pin.gpio + '=' + pin.value)
  })

})


function sendFile(fname, res) {
  console.log(__dirname + '/public/' + fname)
  fs.readFile(__dirname + '/public/' + fname, function(err, data) {
    if (err) {
      res.writeHead(500)
      res.end('unable to load ' + fname) 
    }
    data = data.toString('UTF-8').replace('__host', host)
    res.writeHead(200)
    res.end(data)
  })
}



function setPwm(cmd) {
  var buffer = new Buffer(cmd + "\n");
  fs.open(PI_BLASTER_PATH, "w", undefined, function(err, fd) {
    if (err)
      console.log("Error opening file: " + err);
    else {
      fs.write(fd, buffer, 0, buffer.length, -1, function(error, written, buffer) {
        if (error) 
           console.log("Error occured writing to " + PI_BLASTER_PATH + ": " + error);
        else
           fs.close(fd);
       });
     }
  });
}
