import type {IJoinInfo} from "@/lib/type";
import socketService from "@/service/socketService";
import eventBus from "@/lib/eventBus";
import {EventName, ISdpParams} from "@/service/type";

class WebRTCClient {
    private videoDom: HTMLVideoElement
    private myStream: MediaStream | null = null
    private peerMap: Map<string, RTCPeerConnection> = new Map()
    public isHasAuth: boolean = true
    public constraints: MediaStreamConstraints = {
        audio: true,
        video: true
    }

    constructor(videoDom: HTMLVideoElement, constraints?: MediaStreamConstraints) {
        // socketService.initSocket()
        this.videoDom = videoDom
        if (constraints) this.constraints = constraints
        eventBus.on(EventName.ON_OFFER, async (data: ISdpParams) => {
            await this.createAnswer(data)
        })
        eventBus.on(EventName.ON_ANSWER, async (data: ISdpParams) => {
            const peer = this.peerMap.get(data.targetId)!
            await peer.setRemoteDescription(data.sdp)
        })
    }

    private async getUserMedia() {
        if (!this.myStream) {
            try {
                this.myStream = await navigator.mediaDevices.getUserMedia(this.constraints)
                this.videoDom.srcObject = this.myStream
            } catch (error) {
                this.isHasAuth = false
                console.error('getUserMedia error', error)
            }
        }
    }

    private async createRTCPeer(targetId: string): Promise<RTCPeerConnection> {
        const peer = new RTCPeerConnection()
        this.peerMap.set(targetId, peer)
        if (this.myStream) {
            for (const track of this.myStream.getTracks()) {
                peer.addTrack(track, this.myStream)
            }
        }
        peer.addEventListener("track", (event) => {
            const videoDom = document.getElementById(`video_${targetId}`) as HTMLVideoElement
            videoDom.srcObject = event.streams[0]
        })

        peer.addEventListener("icecandidate", (event) => {
            if (!event.candidate) return
            peer.addIceCandidate(event.candidate)
        })

        peer.addEventListener("iceconnectionstatechange", () => {
            switch (peer.iceConnectionState) {
                case "connected":
                    break
                case "disconnected":
                    break
            }
        })

        return peer
    }

    private async createAnswer(data: ISdpParams) {
        const peer = await this.createRTCPeer(data.targetId)
        const answer = await peer.createAnswer()
        await peer.setRemoteDescription(data.sdp)
        await peer.setLocalDescription(answer)
        socketService.sendAnswer({
            targetId: data.targetId,
            sdp: data.sdp
        })
    }

    public async initRTC(targetId: string) {
        const peer = await this.createRTCPeer(targetId)
        const offer = await peer.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        })
        await peer.setLocalDescription(offer)
        socketService.sendOffer({
            targetId,
            sdp: offer
        })
    }

    public async joinRoom(info: IJoinInfo) {
        await this.getUserMedia()
        // socketService.joinRoom({
        //     username: info.username,
        //     roomId: info.roomId,
        //     videoStatus: info.videoStatus,
        //     isHasAuth: this.isHasAuth
        // })
    }

    // 手机切换前后摄像头
    public switchCamera() {

    }

    // pc切换摄像头
    public changeCamera() {

    }

    public changeCameraStatus(status: boolean) {
        if (this.myStream) {
            this.myStream.getVideoTracks()[0].enabled = status
        }
    }

    public changeMicrophoneStatus(status: boolean) {
        if (this.myStream) {
            this.myStream.getAudioTracks()[0].enabled = status
        }
    }

    public async shareScreen() {
        try {
            await navigator.mediaDevices.getDisplayMedia()
        } catch (error) {
            console.error("play screen fail: ", error)
        }
    }

    public close() {
        this.myStream?.getTracks().forEach(item => {
            item.stop()
        })
        this.peerMap.forEach(item => {
            item.close()
        })
        socketService.closeSocket()
    }
}

export default WebRTCClient