#FROM ubuntu:20.04
FROM ubuntu:19.10

ENV DEBIAN_FRONTEND noninteractive

RUN /usr/bin/apt-get update
RUN /usr/bin/apt-get upgrade -y
RUN /usr/bin/apt-get install -y wget curl pulseaudio xvfb firefox ffmpeg xdotool curl unzip 

# INSTALL NODE HACK
#COPY nodesource.sh /
#RUN /nodesource.sh 

RUN curl -sL https://deb.nodesource.com/setup_13.x | bash -
RUN apt-get install -y nodejs

RUN /usr/bin/apt-get install -y libasound2-dev pkg-config

# RECORDING JAVASCRIPT
COPY /recording /recording
RUN chmod +x /recording/record.js
WORKDIR /recording
RUN /usr/bin/npm install

# ENTRY SCRIPT
COPY run.sh /
RUN chmod +x /run.sh


ENTRYPOINT ["/run.sh"]
