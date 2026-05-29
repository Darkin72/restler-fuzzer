from __future__ import annotations

import argparse
from pathlib import Path


REQUEST_IDS_TO_PATCH = {
    "/v1/requests/{request_id}",
    "/v1/requests/{request_id}/prediction",
    "/api/inference-requests/{request_id}",
    "/api/inference-requests/{request_id}/result",
    "/api/inference-requests/{request_id}/proteins/{protein_id}/result",
    "/api/inference-requests/{request_id}/retry",
    "/api/admin/requests/{request_id}",
    "/api/admin/requests/{request_id}/timeline",
}

FUZZABLE_LINE = '    primitives.restler_fuzzable_string("fuzzstring", quoted=False),'
DYNAMIC_LINE = (
    '    primitives.restler_static_string('
    '_api_inference_requests_post_request_id.reader(), quoted=False),'
)


def patch_request_blocks(content: str) -> tuple[str, int]:
    if "_api_inference_requests_post_request_id" not in content:
        raise RuntimeError("Dynamic request_id variable was not found in grammar.py.")

    lines = content.splitlines()
    patched = 0
    index = 0

    while index < len(lines):
        line = lines[index]
        if not line.startswith('requestId="'):
            index += 1
            continue

        request_id = line[len('requestId="'):-1] if line.endswith('"') else ""
        if request_id not in REQUEST_IDS_TO_PATCH:
            index += 1
            continue

        block_start = index
        while block_start >= 0 and not lines[block_start].startswith("request = requests.Request(["):
            block_start -= 1

        if block_start < 0:
            raise RuntimeError(f"Could not locate request block for {request_id}.")

        replaced = False
        already_dynamic = False
        for block_index in range(block_start, index):
            if lines[block_index] == FUZZABLE_LINE:
                lines[block_index] = DYNAMIC_LINE
                patched += 1
                replaced = True
                break
            if lines[block_index] == DYNAMIC_LINE:
                already_dynamic = True
                break

        if not replaced and not already_dynamic:
            raise RuntimeError(f"Could not patch request_id binding for {request_id}.")

        index += 1

    return "\n".join(lines) + "\n", patched


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Patch RESTler Bio grammar to reuse produced request_id values."
    )
    parser.add_argument("grammar_path", help="Path to the generated Compile/grammar.py file.")
    args = parser.parse_args()

    grammar_path = Path(args.grammar_path)
    if not grammar_path.exists():
        raise FileNotFoundError(f"Grammar file not found: {grammar_path}")

    original = grammar_path.read_text(encoding="utf-8")
    patched_content, patched_count = patch_request_blocks(original)
    grammar_path.write_text(patched_content, encoding="utf-8")
    print(f"Patched {patched_count} request_id bindings in {grammar_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
