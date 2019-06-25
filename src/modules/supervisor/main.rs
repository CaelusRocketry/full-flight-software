use std::thread;
use std::time::Duration;

use crate::modules::sensors::imu::IMU;
use crate::modules::sensors::pressure::Pressure;
use crate::modules::sensors::temperature::Temperature;
use crate::modules::sensors::SensorTrait;


pub fn start() {
    // Initialize sensors
    let mut imu = IMU::new("NOSECONE", 0x28);
    let mut pressure_tank = Pressure::new("TANK", 1.75, 2.0);
    let mut temp_tank = Temperature::new("TANK", 350.0, 400.0);

    // Main loop
    loop {
        println!("{:?}", imu.acc());
        thread::sleep(Duration::from_millis(500));
    }
}