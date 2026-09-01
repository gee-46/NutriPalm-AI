import sys
import importlib

def test_severity_calculator_does_not_import_prediction():
    """
    Ensures that the core deterministic logic in severity_calculator
    is never polluted by the advisory prediction engine (twin_prediction_service).
    """
    # Ensure it's loaded
    import app.services.severity_calculator
    
    # Check if prediction service is in its module dict or sys.modules in a way that implies import from it.
    # A stricter check is to read the AST or source code, but we can also just parse the file.
    import ast
    from pathlib import Path
    
    service_path = Path("app/services/severity_calculator.py")
    if not service_path.exists():
        return # Skip if not found in current cwd, tests run from backend dir
        
    tree = ast.parse(service_path.read_text())
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for name in node.names:
                assert "twin_prediction" not in name.name, "severity_calculator must not import twin_prediction"
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                assert "twin_prediction" not in node.module, "severity_calculator must not import twin_prediction"
