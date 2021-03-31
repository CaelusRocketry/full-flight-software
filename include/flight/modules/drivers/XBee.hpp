#ifndef DESKTOP

    #ifndef FLIGHT_XBEE_HPP
    #define FLIGHT_XBEE_HPP

    #include <string>
    #include <queue>
    #include <cstdio>
    #include <unistd.h>
    #include <flight/modules/lib/Packet.hpp>
    #include <Arduino.h>
    #include <SoftwareSerial.h>

    using namespace std;

    #define BAUD_RATE 9600

    class XBee  {
    private:
        static SoftwareSerial xbee(8, 9);
        bool connection;
        queue<string> ingest_queue;
        string rcvd;

        // lockable object used to specify when things need exclusive access.
        bool TERMINATE_FLAG = false;


    public:
        XBee();
        queue<string> read(int num_messages);
        bool write(const Packet& packet);
        void recv_loop();
        bool get_status() const;
        void reset();
        bool connect();
        void end();
    };


    #endif //FLIGHT_XBEE_HPP

#endif