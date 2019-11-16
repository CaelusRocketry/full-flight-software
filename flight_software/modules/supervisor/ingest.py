from ..telemetry.logging import Log
import subprocess
import sys

TOK_DEL, TYPE_DEL = " ", ":"  # Token and type delimiters

def ingest(log, sense, valv):
    global sensors, valves
    sensors = sense
    valves = valv
    print("Incoming:", log.message)
    print("Normalized: ", log.predict)

    # A dictionary to hep cast all data appropriately
    types = {"int": int,
             "float": float,
             "str": str,
             }

    # Dictionary to convert fuction strings into fuction objects
    funcs = {
        "ABORT": {
            "ABORT": abort,
        },
        "HEARTBEAT": {
            "At": heartbeat
        },
        "core": {
            "ip": get_ip,
            "temp": get_core_temp,
            "speed": get_core_speed
        },
        "sensor": {
            "data": sensor_data
        },
        "valve": {
            "actuate": actuate_valve
        }
    }

    header = log.header
    tokens = log.message.split(TOK_DEL)
    cmd, args = tokens[0], tokens[1:]

    # Casts the values as the type of the object in order to send message as a string
    args = list(map(lambda x: types[x.split(TYPE_DEL)[0]](
        x.split(TYPE_DEL)[1]), args))

    # Attemps to run the fuction assocated with the header, otherwise returns an error
    print(log)
    if header in funcs:
        if cmd in funcs[header]:
            return funcs[header][cmd](*args)
        return "Error", "Unknown command!"
    return "Error", "Unknown header!"


# TODO: Return only the information from these three methods, and have the caller package into a Log
# TODO: change Enqueue and other things into Enum

def get_ip():
    """ Core method - Returns a Log containing the ip of the pi. """
    return "Enqueue", Log(header="RESPONSE", message="192.168.1.35")
    # return "Enqueue", Log(header="RESPONSE", message=(subprocess.getoutput("hostname -I").split()[1]))

def get_core_temp():
    """ Core method - Returns a Log containing the internal temperature of the pi. """
    msg = subprocess.getoutput("/opt/vc/bin/vcgencmd measure_temp")[5:]
    print("Message:", msg)
    return "Enqueue", Log(header="RESPONSE", message=msg)

def get_core_speed():
    """ Core method - Returns a Log containing the clock speed of the pi """
    msg = subprocess.getoutput("lscpu | grep MHz").split()[3] + " MHz"
    return "Enqueue", Log(header="RESPONSE", message=msg)

def find_sensor(type, location):
    """
    Sensor method - Given a sensor location, returns the sensor object from the array
    TODO: Convert sensors into a dictionary
    """
    global sensors
    for sensor in sensors:
        if type == sensor.sensor_type() and location == sensor.location():
            return sensor
    return None

def sensor_data(type, location):
    """
    Sensor method - Returns the data of the sensor given a location
    TODO: Remove assert
    """
    sensor = find_sensor(type, location, sensors)
    assert sensor is not None
    return "Enqueue", Log(
        header="RESPONSE", message=sensor.data, timestamp=timestamp, sender=sensor.name())

def find_valve(id):
    """
    Valve method - Given a valve id, returns the value object from the array
    TODO: turn valves into dictionary
    """
    global valves
    for valve in valves:
        if id == valve.id:
            return valve
    return None

def actuate_valve(id, target, priority):
    """
    Valve method - Actuates the valve at a given proprity, return a Log to be enqueued
    """
    valve = find_valve(id)
    valve.actuate(target, priority)
    return "Enqueue", Log(
        header="INFO", message="Actuated valve", sender="supervisor")

def heartbeat():
    """ Returns a heartbeat Log to show that the connection is alive """
    return "Enqueue", Log(header="HEARTBEAT", message="Ok")

def abort():
    """ Runs the abort methods of all valves """
    ABORT = True
    for valve in valves:
        valve.abort()
    return "Enqueue", Log(
        haeder="INFO", message="Aborting now", sender="supervisor")