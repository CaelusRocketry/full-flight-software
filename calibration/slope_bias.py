sensors = {}
sensor_slopes = {}

while(input("Continue calibrating? (y/n) ") == "y"):
    sensor = input("Which sensor? ")
    x1 = int(input("Enter 1st gs pressure reading (actual = 0): "))
    y1 = 0
    print("---------")
    x2 = int(input("Enter 2st gs pressure reading (actual = 100): "))
    y2 = 100

    m = round((y1-y2)/(x1-x2), 3)
    b = round(-1*m*x1 + y1, 3)
    coords = [x1,y1,x2,y2,m, b]
    slopes = [m, b]

    sensors[sensor] = coords
    sensor_slopes[sensor] = slopes
    print("---------")
    print("Array for ", sensor, ": ", coords)
    print("Full map: ", sensors)
    print("Slopes-intercepts (m,b): ", sensor_slopes)
    print("---------")

print("Slopes-intercepts: ", sensor_slopes)