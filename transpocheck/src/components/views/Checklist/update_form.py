import os

form_path = r"c:\Users\PC\Desktop\APPS\LogisticAPP\transpocheck\src\components\views\Checklist\ChecklistForm.jsx"
with open(form_path, "r", encoding="utf-8") as f:
    form_content = f.read()

# Replace <StepNotes /> with <StepNotes openCamera={openCamera} />
form_content = form_content.replace("{step === 3 && <StepNotes />}", "{step === 3 && <StepNotes openCamera={openCamera} />}")

with open(form_path, "w", encoding="utf-8") as f:
    f.write(form_content)

print("Updated ChecklistForm.jsx")
