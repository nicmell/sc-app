/**
 * Encode raw Float32 PCM samples into a WAV file blob.
 */
export function encodeWav(samples: Float32Array, sampleRate: number, channels: number): Blob {
    const bytesPerSample = 4; // float32
    const dataSize = samples.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');

    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);             // chunk size
    view.setUint16(20, 3, true);              // format: IEEE float
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * bytesPerSample, true); // byte rate
    view.setUint16(32, channels * bytesPerSample, true);              // block align
    view.setUint16(34, 32, true);             // bits per sample

    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // PCM data
    const output = new Float32Array(buffer, 44);
    output.set(samples);

    return new Blob([buffer], {type: 'audio/wav'});
}

function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}
