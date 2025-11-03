// Nome do arquivo: Helpers/RawPrinterHelper.cs
//
// Substitua o conteúdo do seu arquivo por este.
// Este código inclui as correções de EntryPoint (ex: "OpenPrinterA")
// e CharSet = CharSet.Ansi, além de simplificar o WritePrinter.
//
using System;
using System.Runtime.InteropServices;

namespace PrintBridge.Helpers
{
    public class RawPrinterHelper
    {
        // Estrutura e constantes necessárias para a API
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
        public class DOCINFOA
        {
            [MarshalAs(UnmanagedType.LPStr)]
            public string pDocName;
            [MarshalAs(UnmanagedType.LPStr)]
            public string pOutputFile;
            [MarshalAs(UnmanagedType.LPStr)]
            public string pDataType;
        }

        // --- Declarações de P/Invoke CORRIGIDAS ---

        [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

        [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool ClosePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

        [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndDocPrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

        // --- Fim das Declarações de P/Invoke ---


        /// <summary>
        /// Envia um array de bytes para a impressora especificada.
        /// </summary>
        /// <param name="szPrinterName">Nome da impressora (ex: "POS-80C")</param>
        /// <param name="pBytes">Array de bytes (comandos ESC/POS)</param>
        /// <returns>True se a impressão for bem-sucedida</returns>
        public static bool SendBytesToPrinter(string szPrinterName, byte[] pBytes)
        {
            IntPtr hPrinter = IntPtr.Zero;
            int dwWritten = 0;
            DOCINFOA di = new DOCINFOA();
            bool bSuccess = false;

            di.pDocName = "ADEGA GS - Pedido"; // Nome do documento na fila de impressão
            di.pDataType = "RAW"; // Especifica que estamos enviando dados brutos

            // 1. Abrir a impressora
            if (OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero))
            {
                // 2. Iniciar o documento
                if (StartDocPrinter(hPrinter, 1, di))
                {
                    // 3. Iniciar a página
                    if (StartPagePrinter(hPrinter))
                    {
                        // 4. Escrever os bytes.
                        // Esta versão é mais segura pois passa o array gerenciado diretamente.
                        bSuccess = WritePrinter(hPrinter, pBytes, pBytes.Length, out dwWritten);
                        
                        // 5. Finalizar a página
                        EndPagePrinter(hPrinter);
                    }
                    // 6. Finalizar o documento
                    EndDocPrinter(hPrinter);
                }
                // 7. Fechar a impressora
                ClosePrinter(hPrinter);
            }
            
            // Se bSuccess for falso, podemos verificar o último erro do Win32
            if (bSuccess == false)
            {
                int dwError = Marshal.GetLastWin32Error();
                // Aqui você pode logar o dwError para mais detalhes do que falhou
                // Ex: throw new System.ComponentModel.Win32Exception(dwError);
            }
            
            return bSuccess;
        }
    }
}