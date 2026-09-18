# WINDOWS:
# NVIDIA GPU (CUDA 12.6 as an example)
python -m pip install paddlepaddle-gpu==3.2.1 -i https://www.paddlepaddle.org.cn/packages/stable/cu129/

python -m pip install -U "paddleocr[doc-parser]"

paddleocr install_genai_server_deps vllm


# MAC_OS
pip install "mlx-vlm>=0.3.11"