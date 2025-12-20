#pragma once

using namespace System;
using namespace System::Collections::Generic;

namespace KarutaTraining {
    public ref struct CardItem
    {
        int Id;
        String^ Reading;
    };

    public ref class CommonSettings
    {
    public:
        bool AllOrPart;
        List<int>^ SelectedIds;
        array<bool>^ NoneCards;
    };

    public ref class FudaNagashiSettings
    {
    public:
        String^ Direction;
        bool JudgeByRomaji;
        bool Changing;
        bool AutoAdvance;
        int WaitMs;
        int Count;
    };

    public ref class AppSettings
    {
    public:
        CommonSettings^ Common;
        FudaNagashiSettings^ FudaNagashi;
    };

    public ref struct KimarijiData
    {
        List<CardItem^>^ Items;
        Dictionary<String^, array<String^>^>^ RomajiConsonant;
        Dictionary<String^, String^>^ RomajiVowels;
    };
}
