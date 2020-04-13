IMAGE_NAME=meetingbcast
IMAGE_VERSION=latest
ENV_FILE=container.env
CONTAINER_NAME=bcast
IMAGE_LABEL=$(IMAGE_NAME):$(IMAGE_VERSION)
VOLUME=/Users/nhuisman/workplace/amazon-chime-meeting-broadcast-demo/express/

all: image

image:
	docker image build -t $(IMAGE_LABEL) .

run:
	docker run --rm --env-file $(ENV_FILE) --name $(CONTAINER_NAME) $(IMAGE_LABEL) 2>&1 | tee $(CONTAINER_NAME).log

run_with_mount:
	docker run --rm --env-file $(ENV_FILE) -v ${VOLUME}:/express  --name $(CONTAINER_NAME) -it $(IMAGE_LABEL) 2>&1 | tee $(CONTAINER_NAME).log

.PHONY: all image run
