#ifndef FLIGHT_TELEMETRYTASK_HPP
#define FLIGHT_TELEMETRYTASK_HPP

#include <string>
#include <flight/modules/tasks/Task.hpp>

#ifdef DESKTOP
    #include <flight/modules/drivers/Telemetry.hpp>
#else 
    #include <flight/modules/drivers/XBee.hpp>
#endif


class TelemetryTask : public Task {
private:
#ifdef DESKTOP
    Telemetry* telemetry;
#else
    XBee* telemetry;
#endif
    void enqueue();

public:
    TelemetryTask() = default;
    void initialize() override;
    void read() override;
    void actuate() override;
};


#endif //FLIGHT_TELEMETRYTASK_HPP
