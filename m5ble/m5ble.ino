#include <M5StickCPlus.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define SERVICE_UUID "1bc68b2a-f3e3-11e9-81b4-2a2ae2dbcce4"
#define CHARACTERISTIC_RX_UUID "1bc68da0-f3e3-11e9-81b4-2a2ae2dbcce4"
#define CHARACTERISTIC_TX_UUID "1bc68efe-f3e3-11e9-81b4-2a2ae2dbcce4"
BLEServer *pServer = NULL;
BLECharacteristic *pCharacteristic = NULL;
BLEService *pService = NULL;

TFT_eSprite canvas = TFT_eSprite(&M5.Lcd);
float batt = 0;
const char *title = NULL;
void updateCanvas(const char *msg = NULL)
{
  canvas.fillSprite(BLACK);
  canvas.setCursor(0, 0);
  if (msg)
    title = msg;
  canvas.print(title);

  float vbat = M5.Axp.GetBatVoltage();
  int cbat = vbat / 4.2f * 100.0f;
  if (cbat != batt)
  {
    batt = cbat;
    int wbat = M5.Axp.GetWarningLeve();
    //canvas.fillSprite(BLACK);
    canvas.setCursor(0, 30);
    canvas.printf(" Bat: %d%%\n", cbat);
    canvas.printf(" Vol: %.2f\n", vbat);
    canvas.printf(" WLv: %d\n", wbat);
    canvas.pushSprite(0, 0);
  }
}

struct
{
  uint32_t stat;
  float temp;
  float pitch;
  float roll;
  float yaw;
  float gx;
  float gy;
  float gz;
  float ax;
  float ay;
  float az;
} txBuf = {0};

class ServerCallbacks : public BLEServerCallbacks
{
  void onConnect(BLEServer *pServer)
  {
    updateCanvas("Connect");
    pServer->getAdvertising()->stop();
  }
  void onDisconnect(BLEServer *pServer)
  {
    updateCanvas("Disconnect");
  }
};

class RxCallbacks : public BLECharacteristicCallbacks
{
  void onWrite(BLECharacteristic *pCharacteristic)
  {
    //pCharacteristic->getData();
  }
};

void InitBLEServer()
{
  uint64_t chipid = ESP.getEfuseMac();
  String blename = "M5-" + String((uint32_t)(chipid >> 32), HEX);

  BLEDevice::init(blename.c_str());
  //Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());
  //Service
  pService = pServer->createService(SERVICE_UUID);
  //Tx
  pCharacteristic = pService->createCharacteristic(CHARACTERISTIC_TX_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pCharacteristic->addDescriptor(new BLE2902());
  //Rx
  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(CHARACTERISTIC_RX_UUID, BLECharacteristic::PROPERTY_WRITE);
  pRxCharacteristic->addDescriptor(new BLE2902());
  pRxCharacteristic->setCallbacks(new RxCallbacks());
}

void advertise()
{
  updateCanvas("Ready");
  pService->start();
  pServer->getAdvertising()->start();
}

void setup()
{
  M5.begin();
  M5.Axp.ScreenBreath(8); //7..12
  M5.Lcd.setRotation(1);
  canvas.createSprite(240, 135);
  canvas.fillSprite(BLACK);
  canvas.setTextColor(WHITE);
  canvas.setTextSize(3);

  M5.Imu.Init();

  InitBLEServer();
  advertise();
}

void loop()
{
  M5.update();
  if (pServer->getConnectedCount())
  {
    txBuf.stat = 0;
    txBuf.stat |= M5.BtnA.wasPressed() ? 1 : 0;
    txBuf.stat |= M5.BtnB.wasPressed() ? 2 : 0;
    txBuf.stat |= M5.BtnA.isPressed() ? 4 : 0;
    txBuf.stat |= M5.BtnB.isPressed() ? 8 : 0;
    //
    M5.Imu.getTempData(&txBuf.temp);
    M5.Imu.getAhrsData(&txBuf.pitch, &txBuf.roll, &txBuf.yaw);
    M5.Imu.getGyroData(&txBuf.gx, &txBuf.gy, &txBuf.gz);
    M5.Imu.getAccelData(&txBuf.ax, &txBuf.ay, &txBuf.az);
    pCharacteristic->setValue((uint8_t *)&txBuf, sizeof(txBuf));
    pCharacteristic->notify();
  }
  updateCanvas();
  delay(1000 / 25);
}
