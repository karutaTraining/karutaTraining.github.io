#pragma once

#include "Models.h"
#include "DataStore.h"
#include "Utils.h"

using namespace System;
using namespace System::Collections::Generic;
using namespace System::Drawing;
using namespace System::Windows::Forms;

namespace KarutaTraining {
    public ref struct ReadHistory
    {
        bool ChangedAtRead;
        bool Correct;
    };

    public ref class MainForm : public Form
    {
    public:
        MainForm();

    private:
        AppSettings^ settings;
        KimarijiData^ kimariji;
        Dictionary<String^, String^>^ cardImages;
        Dictionary<String^, Image^>^ imageCache;

        List<CardItem^>^ remaining;
        List<int>^ reads;
        Dictionary<int, ReadHistory^>^ history;
        int idx;
        bool awaitingNext;
        bool advanced;
        bool listModeSyllable;

        Timer^ autoTimer;
        Random^ rng;

        Label^ titleLabel;
        Label^ progressLabel;
        ProgressBar^ progressBar;
        PictureBox^ cardImage;
        TextBox^ answerInput;
        Button^ answerButton;
        Button^ skipButton;
        Button^ resetButton;
        ListView^ listView;
        Button^ toggleListButton;
        Label^ remainLabel;
        Label^ statusLabel;
        Label^ resultLabel;

        void InitializeUi();
        void LoadData();
        void ResetAll();
        void ShowQuestion();
        void AdvanceToNext();
        void OnAnswerKeyDown(Object^ sender, KeyEventArgs^ e);
        void SubmitAnswer();
        void SkipQuestion();
        void UpdateProgress();
        void RenderList();
        void UpdateImageForId(int id);
        String^ ExpectedPrefix(String^ reading);
        String^ CurrentReading();
        int CurrentId();
        List<int>^ DecideAllowedIds();
        List<CardItem^>^ SessionCards();
        Image^ GetCardImage(String^ token);
        void ApplyRotation(Image^ source, bool upsideDown);
    };
}
