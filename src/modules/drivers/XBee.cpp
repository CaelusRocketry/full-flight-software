#ifndef DESKTOP
    #include <flight/modules/lib/logger_util.hpp>
    #include <flight/modules/drivers/XBee.hpp>
    #include <flight/modules/mcl/Config.hpp>
    #include <flight/modules/lib/Errors.hpp>
    #include <flight/modules/lib/Packet.hpp>

    #include <ArduinoJson.h>
    #include <SoftwareSerial.h>

    XBee::XBee() {
        // Initialize variables
        connection = false;
        xbee = new SoftwareSerial(global_config.telemetry.XBEE_RX_PIN, global_config.telemetry.XBEE_TX_PIN);
    }

    queue<string> XBee::read(int num_messages) {
        print("XBee: Reading: " + rcvd);

        read_buffer();
        if (num_messages > (int) ingest_queue.size() || num_messages == -1){
            num_messages = (int) ingest_queue.size();
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

        string output;
        Packet::to_string(output, packet);

        string packet_string = "^" + output + "$";
        print("XBee: Sending packet: " + packet_string);

        for (size_t i = 0; i < packet_string.size(); i += 255)
        {
            string subpacket_string = packet_string.substr(i, 255);
            
                try {
                    char const *c = subpacket_string.c_str();
                    xbee->write(c);
                }
                catch (std::exception& e) {
                    print(e.what());
                    throw XBEE_WRITE_ERROR();
                }
            
        }

        return true;
    }

    void XBee::read_buffer() {
        while (this->connection && !TERMINATE_FLAG && xbee->available()) {
            try {
                // Read in data from socket
                // const char* msg(xbee->read());
                // string msg_str(msg);
                char msg = xbee->read();
                string msg_str(1, msg);
                rcvd.append(msg_str);
            }
            catch (std::exception& e){
                print(e.what());
                end();
                throw XBEE_READ_ERROR();
            }
        }
        print("XBee: Received: " + rcvd);

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

    bool XBee::get_status() const {
        return connection;
    }

    void XBee::reset() {
        end();
        bool res = connect();
        if( !res ) {
            end();
        }
    }

    bool XBee::connect() {
        print("XBee: Connecting");

        try {
            xbee->begin(global_config.telemetry.XBEE_BAUD_RATE);
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

