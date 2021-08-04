import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js'
// Renderer
const canvas3 = document.getElementById('canvas3')
const renderer = new THREE.WebGLRenderer({
  canvas: canvas3,
  antialias: false,
  alpha: false,
  stencil: false,
  preserveDrawingBuffer: true // important!
})
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(canvas3.width, canvas3.height)
// Camera
const camera = new THREE.PerspectiveCamera(40.0, canvas3.width / canvas3.height, 0.1, 1000)
camera.position.set(0, 0, 10)
camera.lookAt(new THREE.Vector3(0, 0, 0))
// Scene
const scene = new THREE.Scene()
// Light
const ambient = new THREE.AmbientLight(0x404040)
const light = new THREE.DirectionalLight(0xFFFFFF)
light.position.set(1.0, 1.0, 1.0).normalize()
scene.add(ambient)
scene.add(light)
// Object
const geometry = new THREE.BoxGeometry(1, 0.5, 2)
const material = new THREE.MeshStandardMaterial({ color: 'orange' })
const cube = new THREE.Mesh(geometry, material)
scene.add(cube)
// 2D
const MAX = 500
const camera2d = new THREE.OrthographicCamera(-MAX, MAX, MAX, -MAX, 0.001, 10000)
camera2d.position.set(0, 0, -1)
camera2d.lookAt(new THREE.Vector3(0, 0, 0))
const circle = new THREE.CircleGeometry(1, 12)
const cursor = new THREE.Mesh(circle, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: false }))
cursor.scale.set(10, 10, 1)
const scene2d = new THREE.Scene()
scene2d.add(cursor)

const LPF = 0.4
const gyro = { x: 0, y: 0, z: 0 }
function moveCursor(gx, gy, gz) {
  const x = LPF * gx + (1 - LPF) * gyro.x
  const y = LPF * gy + (1 - LPF) * gyro.y
  const z = LPF * gz + (1 - LPF) * gyro.z
  cursor.position.x += z
  if (cursor.position.x > MAX) cursor.position.x = MAX
  if (cursor.position.x < -MAX) cursor.position.x = -MAX
  cursor.position.y += x
  if (cursor.position.y > MAX) cursor.position.y = MAX
  if (cursor.position.y < -MAX) cursor.position.y = -MAX
  gyro.x = x
  gyro.y = y
  gyro.z = z
}

// BLE
let device
let deviceList = []
const canvas2 = document.getElementById('canvas2')
const context = canvas2.getContext('2d')

function drawValue(of, val) {
  const x0 = canvas2.width / 2
  context.fillText(val, 10, of)
  context.fillRect(x0 + val, of, 10, 10)
  return of + 20
}

async function handler(event) {
  let of = 0
  const stat = event.target.value.getUint32(of, true); of += 4 // little-endian
  const temp = event.target.value.getFloat32(of, true); of += 4
  const pitch = event.target.value.getFloat32(of, true); of += 4
  const roll = event.target.value.getFloat32(of, true); of += 4
  of += 4 //const yaw = event.target.value.getFloat32(of, true) - count * 0.095; of += 4
  const gx = event.target.value.getFloat32(of, true) + 0.45; of += 4
  const gy = event.target.value.getFloat32(of, true) - 1.0; of += 4
  const gz = event.target.value.getFloat32(of, true) - 2.35; of += 4
  const ax = event.target.value.getFloat32(of, true); of += 4
  const ay = event.target.value.getFloat32(of, true); of += 4
  const az = event.target.value.getFloat32(of, true); of += 4

  const euler = new THREE.Euler(THREE.Math.degToRad(roll), 0, -THREE.Math.degToRad(pitch), 'ZYX')
  cube.setRotationFromEuler(euler)
  moveCursor(gx, gy, gz)

  //draw
  context.clearRect(0, 0, canvas2.width, canvas2.height)
  of = 40
  context.fillStyle = 'black'
  of = drawValue(of, stat)
  of = drawValue(of, temp)
  //
  context.fillStyle = 'red'
  of = drawValue(of, pitch)
  of = drawValue(of, roll)
  //of = drawValue(of, yaw)
  //
  context.fillStyle = 'green'
  of = drawValue(of, gx)
  of = drawValue(of, gy)
  of = drawValue(of, gz)
  //
  context.fillStyle = 'blue'
  of = drawValue(of, ax * 90 + 1.0)
  of = drawValue(of, ay * 90 - 0.5)
  of = drawValue(of, az * 90 - 7.0)
  //3D
  renderer.clear()
  renderer.render(scene, camera)
  //2D
  renderer.autoClear = false
  renderer.render(scene2d, camera2d)
}

async function scan() {
  document.getElementById('deviceList').innerHTML = ''
  deviceList = []
  //to receive device list in main, notify to main
  if (window.api) window.api.send('scan', 'scan')

  device = await navigator.bluetooth.requestDevice({
    //acceptAllDevices: true,
    filters: [{ namePrefix: 'M5' }],
    optionalServices: ['1bc68b2a-f3e3-11e9-81b4-2a2ae2dbcce4']
  })
  console.log('device', device)
  device.addEventListener('gattserverdisconnected', (event) => {
    console.log('onDisconnect', event)
  })
  console.log('connect...')

  device.gatt.disconnect()
  const server = await device.gatt.connect()
  console.log('server', server)

  const services = await server.getPrimaryServices()
  console.log('services', server, services)

  for (let service of services) {
    console.log('service', service)

    var characteristics = await service.getCharacteristics()
    console.log('characteristics', characteristics)

    for (let characteristic of characteristics) {
      console.log('characteristic', characteristic)

      // notification
      const descriptors = await characteristic.getDescriptors()
        .catch((err) => {
          console.error(err)
        })
      console.log('descriptors', descriptors)
      if (characteristic.properties.notify) {
        characteristic.startNotifications()
          .then(() => {
            characteristic.addEventListener('characteristicvaluechanged', handler)
          })
          .catch(error => {
            console.error(error)
            //device.gatt.disconnect()
            //device = undefined
          })
      }
    }
  }
}
function disconnect() {
  if (device) {
    device.gatt.disconnect()
  }
}

if (window.api) {
  //receive device information
  window.api.on('discoverd-device', (message) => {
    const device = JSON.parse(message)
    if (!deviceList.includes(device.deviceId)) {
      deviceList.push(device.deviceId)
      const item = document.createElement('option')
      item.setAttribute('value', device.deviceId)
      item.innerHTML = device.deviceName
      document.getElementById('deviceList').appendChild(item)
    }
  })
}
//send deviceId to renderer
const setConnectDeviceId = (deviceId) => {
  //document.getElementById('deviceList').innerHTML = ''
  if (window.api) window.api.send('connectDeviceId', deviceId)
}

document.getElementById('scan').addEventListener('click', (event) => scan())
document.getElementById('disconnect').addEventListener('click', (event) => disconnect())
document.getElementById('deviceList').addEventListener('click', (event) => {
  setConnectDeviceId(deviceList[document.getElementById('deviceList').selectedIndex])
})
