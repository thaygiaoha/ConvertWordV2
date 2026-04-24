Sub ExportToMathJaxHTML()
    ' VBA Script chuyển đổi Word chứa LaTeX sang HTML chuẩn MathJax
    ' Hỗ trợ giữ nguyên định dạng gạch chân và các ký hiệu (anh)
    
    Dim doc As Document
    Dim htmlContent As String
    Dim para As Paragraph
    Dim text As String
    Dim filePath As String
    
    Set doc = ActiveDocument
    
    htmlContent = "<html><head>" & vbCrLf & _
                  "<meta charset='utf-8'>" & vbCrLf & _
                  "<script src='https://polyfill.io/v3/polyfill.min.js?features=es6'></script>" & vbCrLf & _
                  "<script id='MathJax-script' async src='https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js'></script>" & vbCrLf & _
                  "<style>" & vbCrLf & _
                  "  body { font-family: 'Times New Roman', serif; line-height: 1.6; padding: 40px; max-width: 800px; margin: auto; }" & vbCrLf & _
                  "  p { margin-bottom: 15px; }" & vbCrLf & _
                  "  .anh { color: blue; font-weight: bold; border: 1px dashed blue; padding: 2px 5px; }" & vbCrLf & _
                  "  u { text-underline-offset: 3px; }" & vbCrLf & _
                  "</style></head><body>" & vbCrLf
    
    For Each para In doc.Paragraphs
        text = para.Range.text
        text = Left(text, Len(text) - 1) ' Loại bỏ ký tự xuống dòng của Word
        
        If Len(Trim(text)) > 0 Then
            ' Xử lý ký tự đặc biệt HTML
            text = Replace(text, "&", "&amp;")
            text = Replace(text, "<", "&lt;")
            text = Replace(text, ">", "&gt;")
            
            ' Khôi phục lại các thẻ HTML đã bị encode (nếu có)
            text = Replace(text, "&lt;u&gt;", "<u>")
            text = Replace(text, "&lt;/u&gt;", "</u>")
            
            ' Style cho cụm (anh)
            text = Replace(text, "(anh)", "<span class='anh'>(anh)</span>")
            
            htmlContent = htmlContent & "<p>" & text & "</p>" & vbCrLf
        Else
            htmlContent = htmlContent & "<p>&nbsp;</p>" & vbCrLf
        End If
    Next para
    
    htmlContent = htmlContent & "</body></html>"
    
    filePath = doc.Path & "\" & Left(doc.Name, InStrRev(doc.Name, ".") - 1) & "_Export.html"
    
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    Dim oFile As Object
    Set oFile = fso.CreateTextFile(filePath, True, True) ' True cho Unicode
    oFile.WriteLine htmlContent
    oFile.Close
    
    MsgBox "Đã xuất file HTML chuẩn MathJax tại: " & vbCrLf & filePath, vbInformation, "MathDigitizer"
End Sub
