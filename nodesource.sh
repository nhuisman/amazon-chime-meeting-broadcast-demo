#!/bin/bash

set -xeo pipefail

wget https://deb.nodesource.com/node_12.x/pool/main/n/nodejs/nodejs_12.16.1-1nodesource1_amd64.deb
dpkg-deb -R nodejs_12.16.1-1nodesource1_amd64.deb tmp
cd tmp
cat DEBIAN/control| sed -e 's/python-minimal/python2-minimal/g'|sed -e 's/nodesource1/nodesource2/g' > DEBIAN/control.tmp ; cat DEBIAN/control.tmp > DEBIAN/control ; rm DEBIAN/control.tmp
cd ..
dpkg-deb -b tmp nodejs_12.16.1-1nodesource2_amd64_new.deb 
apt install ./nodejs_12.16.1-1nodesource2_amd64_new.deb -y
