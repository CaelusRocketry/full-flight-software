#ifndef DESKTOP

    #include <flight/modules/lib/logger_util.hpp>
    #include <flight/modules/drivers/XBee.hpp>
    #include <flight/modules/mcl/Config.hpp>
    #include <flight/modules/lib/Errors.hpp>
    #include <string>
    #include <ArduinoJson.h>

    XBee::XBee() {
        // Initialize variables
        connection = false;
    }

    queue<string> XBee::read(int num_messages) {
        if (num_messages > ingest_queue.size() || num_messages == -1){
            num_messages = ingest_queue.size();
        }

        // type of list where elements are exclusively inserted from one side and removed from the other.
        queue<string> q;
        for (int i = 0; i < num_messages; i++){
            q.push(ingest_queue.front());
            ingest_queue.pop();
        }

        return q;
    }

    // This sends the packet to the GUI!
    bool XBee::write(const Packet& packet) {

        string packet_string;
        to_string(packet_string, packet);
        packet_string = "^" + packet_string + "$";
        print("Telemetry: Sending packet: " + packet_string);

        for (size_t i = 0; i < packet_string.size(); i += 255)
        {
            string subpacket_string = packet_string.substr(i, 255);
            try {
                xbee.write(subpacket_string);
            }
            catch (std::exception& e) {
                print(e.what());
                throw XBEE_WRITE_ERROR();
            }
        }

        return true;
    }

    // This gets called in the main thread
    void XBee::recv_loop() {
        while (this->connection && !TERMINATE_FLAG) {
            try {
                // Read in data from socket
                if(xbee.avaliable()) {
                    string msg(xbee.read());
                    rcvd.append(msg);

                    print("Telemetry: Received: " + msg);
                }

            }
            catch (std::exception& e){
                print(e.what());
                end();
                throw XBEE_READ_ERROR();
            }


            size_t packet_start = rcvd.find('^');
            if(packet_start != string::npos) {
                size_t packet_end = rcvd.find('$', packet_start);
                if (packet_end != string::npos) {
                    string incoming_packet = rcvd.substr(packet_start + 1, packet_end - packet_start - 1);
                    print("Telemetry: Received Full Packet: " + incoming_packet);
                    ingest_queue.push(incoming_packet);

                    rcvd = rcvd.substr(packet_end + 1);
                }
            }

        }
    }

    bool XBee::get_status() const {
        return connection;
    }

    void XBee::reset() {
        end();
        if(!connect()){
            end();
        }
    }

    bool XBee::connect() {
        try {
            print("Telemetry: Connecting");
            xbee.begin(BAUD_RATE)
        } catch(std::exception& e) {
            print(e.what());
            throw XBEE_CONNECTION_ERROR();
        }

        connection = true;
        TERMINATE_FLAG = false;

        return true;
    }

    void XBee::end() {
        TERMINATE_FLAG = true;
        connection = false;
    }

#endif