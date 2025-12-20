#pragma once

#include "Models.h"

using namespace System;
using namespace System::Collections::Generic;

namespace KarutaTraining {
    public ref class DataStore abstract sealed
    {
    public:
        static Dictionary<String^, String^>^ LoadCardImages(String^ baseDir);
        static KimarijiData^ LoadKimarijiData(String^ baseDir);
        static AppSettings^ LoadSettings(String^ baseDir);
    };
}
