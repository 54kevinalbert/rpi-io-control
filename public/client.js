/**
 * clientside control
 */


var socket = io.connect('__host');

socket.on('read', function(data) {
  pins[data.channel].value = data.value
  valueChanged(pins[data.channel])
})

var pins = {},
    IO_TYPE_NONE  = 'none',
    IO_TYPE_READ  = 'read',
    IO_TYPE_WRITE = 'write',
    IO_TYPE_PWM   = 'pwm'

_pins.forEach(function(pin) {
  var o = {
    channel:  pin[0],
    gpio: pin[1],
    value:      0,
    ioType:     IO_TYPE_NONE
  }
  pins[pin[0]] = o
})


function typeChanged(pin) {
  $('#'+pin.channel+' .type .mode').val(pin.ioType)
  $('#'+pin.channel+' .info').hide()
  $('#'+pin.channel+' .'+pin.ioType).show()
  pin.value = 0
  valueChanged(pin)
}

function valueChanged(pin, dontShow) {
  var r = 120 - Math.floor(41 * pin.value),
      g = 120 + Math.floor(79 * pin.value),
      b = 120 - Math.floor(55 * pin.value)
  var valNode = $('#'+pin.channel+' .val')
  valNode.css('background', 'rgb('+r+','+g+','+b+')')
  if (pin.ioType == IO_TYPE_PWM) valNode.text(pin.value)
  else valNode.empty()
  if (!dontShow) $('#'+pin.channel+' .pwm input').val(pin.value * 1000)
}

$('select').change(function() {
  var pin = pins[$(this).parent().parent().attr('id')]
  pin.ioType = $(this).val()
  socket.emit('typeChanged', pin)
  typeChanged(pin)
})

$('.row').click(function() {
  var pin = pins[$(this).attr('id')]
  if (pin.ioType != IO_TYPE_WRITE) return
  pin.value = pin.value == 1 ? 0 : 1
  socket.emit('write', pin)
  valueChanged(pin)
})

$('.pwm input').change(function() {
  var pin = pins[$(this).parent().parent().attr('id')]
  pin.value = $(this).val() / $(this).attr('max')
  socket.emit('pwm', pin)
  valueChanged(pin, true)
})



