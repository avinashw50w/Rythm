import ffmpeg
import os
import json
import numpy as np
from scipy.io import wavfile
import tempfile

def get_audio_metadata(file_path):
    try:
        probe = ffmpeg.probe(file_path)
        format_info = probe['format']
        tags = format_info.get('tags', {})
        
        duration = float(format_info.get('duration', 0))
        bitrate = format_info.get('bit_rate', None)
        size = int(format_info.get('size', 0))
        
        return {
            "title": tags.get('title', os.path.basename(file_path)),
            "artist": tags.get('artist', 'Unknown Artist'),
            "album": tags.get('album', 'Unknown Album'),
            "genre": tags.get('genre', 'Unknown Genre'),
            "duration": duration,
            "bitrate": bitrate,
            "size": size,
            "album_art_path": extract_album_art(file_path)
        }
    except ffmpeg.Error as e:
        print(f"Error probing file {file_path}: {e}")
        return None

def extract_album_art(file_path):
    try:
        # Create directory if not exists
        art_dir = "uploads/album_art"
        os.makedirs(art_dir, exist_ok=True)
        
        # Generate unique filename
        import uuid
        filename = f"{uuid.uuid4()}.jpg"
        output_path = os.path.join(art_dir, filename)
        
        # Extract cover art
        (
            ffmpeg
            .input(file_path)
            .output(output_path, an=None, vcodec='copy')
            .run(quiet=True, overwrite_output=True)
        )
        
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            return output_path
        else:
            if os.path.exists(output_path):
                os.remove(output_path)
            return None
            
    except Exception as e:
        print(f"Error extracting album art: {e}")
        return None

def extract_waveform(file_path, num_points=100):
    """
    Extracts a simplified waveform (array of decibels) for visualization.
    """
    try:
        # Convert to wav temporarily to read with scipy
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_wav:
            temp_wav_name = temp_wav.name
            
        (
            ffmpeg
            .input(file_path)
            .output(temp_wav_name, ac=1, ar=8000) # Mono, 8kHz for speed
            .overwrite_output()
            .run(quiet=True)
        )
        
        sample_rate, data = wavfile.read(temp_wav_name)
        os.remove(temp_wav_name)
        
        # Normalize data
        if data.dtype != np.float32:
            data = data.astype(np.float32)
        
        # Take absolute value
        data = np.abs(data)
        
        # Downsample to num_points
        chunk_size = len(data) // num_points
        if chunk_size == 0:
            return [0] * num_points
            
        waveform = []
        for i in range(num_points):
            start = i * chunk_size
            end = start + chunk_size
            chunk = data[start:end]
            if len(chunk) > 0:
                # Use max or average of the chunk
                val = np.mean(chunk)
                waveform.append(float(val))
            else:
                waveform.append(0.0)
                
        # Normalize to 0-1 range for frontend
        max_val = max(waveform) if waveform else 1
        if max_val > 0:
            waveform = [x / max_val for x in waveform]
            
        return waveform
        
    except Exception as e:
        print(f"Error extracting waveform: {e}")
        return []
