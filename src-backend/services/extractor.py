import os
import platform
import pymupdf

def extract_document_text(file_path: str, ext: str) -> tuple[str, str]:
    """
    Extracts text from a document using a hybrid pipeline:
    1. For digital PDFs, uses PyMuPDF (fitz) for sub-second, lossless text extraction.
    2. For scanned PDFs (minimal/no text layer) and images, falls back to local PaddleOCR / MLX-VLM.
    
    Returns:
        tuple[str, str]: (extracted_text, method_used) where method is 'digital_pdf' or 'vlm_ocr'
    """
    clean_ext = ext.lower() if ext.startswith('.') else f".{ext.lower()}"

    # Fast path: Digital PDF extraction
    if clean_ext == ".pdf":
        try:
            with pymupdf.open(file_path) as doc:
                extracted_pages: list[str] = []
                total_chars = 0
                total_pages = len(doc)

                for page_idx in range(total_pages):
                    page = doc[page_idx]
                    page_text = page.get_text("text").strip()
                    if page_text:
                        extracted_pages.append(f"--- Page {page_idx + 1} ---\n{page_text}")
                        total_chars += len(page_text)

                # Density threshold: Ensure sufficient text exists per page, avoiding sparse headers on scanned pages
                avg_chars_per_page = total_chars / total_pages if total_pages > 0 else 0
                if total_chars >= 50 and avg_chars_per_page >= 35:
                    return "\n\n".join(extracted_pages), "digital_pdf"

        except Exception:
            # If pymupdf fails to open or read, proceed to OCR fallback
            pass

    # Fallback path: Local VLM OCR (PaddleOCR on Windows, MLX-VLM on macOS)
    try:
        from paddleocr import PaddleOCRVL

        if platform.system() == "Windows":
            pipeline = PaddleOCRVL(
                use_layout_detection=False,
                vl_rec_api_model_name="PaddlePaddle/PaddleOCR-VL-1.6",
            )
        else:
            pipeline = PaddleOCRVL(
                use_layout_detection=False,
                vl_rec_backend="mlx-vlm-server",
                vl_rec_server_url="http://localhost:8111/",
                vl_rec_api_model_name="PaddlePaddle/PaddleOCR-VL-1.6",
            )

        output = pipeline.predict(input=file_path)
        if not output or 'parsing_res_list' not in output[0]:
            raise RuntimeError("VLM OCR produced no parsing results.")

        ocr_text = str(output[0]['parsing_res_list'])
        return ocr_text, "vlm_ocr"

    except Exception as err:
        err_str = str(err)
        if "localhost:8111" in err_str or "Connection" in err_str or "Failed to establish" in err_str:
            raise RuntimeError(
                "Local VLM OCR server is unreachable on http://localhost:8111. "
                "For scanned PDFs and image files, please ensure 'mlx_vlm.server --port 8111' is running."
            ) from err
        raise RuntimeError(f"VLM OCR extraction error: {err_str}") from err
