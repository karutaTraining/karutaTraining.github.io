#pragma once

#include "Models.h"

using namespace System;
using namespace System::Collections::Generic;

namespace KarutaTraining {
    public ref class KarutaUtils abstract sealed
    {
    public:
        static List<String^>^ ToChars(String^ input);
        static int LcpChars(String^ a, String^ b);
        static String^ PrefixChars(String^ input, int count);
        static bool HasHiragana(String^ input);
        static bool HasAlphabet(String^ input);
        static bool IsAsciiOnly(String^ input);
        static void Shuffle<T>(List<T>^ list, Random^ rng);
        static String^ ComputeExpectedPrefix(int currentId, List<CardItem^>^ items, List<int>^ candidateIds);
        static String^ RomajiToHiraganaStrict(String^ input, Dictionary<String^, String^>^ vowels, Dictionary<String^, array<String^>^>^ consonants);
    };
}
