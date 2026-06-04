import 'package:flutter/material.dart';
import 'dart:async';
import '../theme/app_theme.dart';
import '../data/questions_database.dart';

class BattleScreen extends StatefulWidget {
  const BattleScreen({super.key});

  @override
  State<BattleScreen> createState() => _BattleScreenState();
}

class _BattleScreenState extends State<BattleScreen> {
  final List<Question> _questions = QuestionsDatabase.getActiveQuestions();
  int _currentQuestionIndex = 0;
  
  String? _selectedAnswer;
  bool _isAnswerLocked = false;
  bool _isRoundOver = false;
  
  Timer? _timer;
  int _secondsLeft = 15; // 15 ثانية حسب الخطة
  
  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _secondsLeft = 15;
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() {
        if (_secondsLeft > 0) {
          _secondsLeft--;
        } else {
          _timer?.cancel();
          _endRound();
        }
      });
    });
  }

  void _lockAnswer(String answer) {
    if (_isAnswerLocked || _isRoundOver) return;
    setState(() {
      _selectedAnswer = answer;
      _isAnswerLocked = true;
      // لا نكشف الإجابة إلا بعد انتهاء الوقت
    });
  }

  void _endRound() {
    setState(() {
      _isRoundOver = true;
    });
    
    // بعد عرض النتيجة بقليل، ننتقل للسؤال التالي
    Future.delayed(const Duration(seconds: 3), () {
      if (!mounted) return;
      if (_currentQuestionIndex < _questions.length - 1) {
        setState(() {
          _currentQuestionIndex++;
          _selectedAnswer = null;
          _isAnswerLocked = false;
          _isRoundOver = false;
          _startTimer();
        });
      } else {
        // انتهت اللعبة، يمكن الانتقال لشاشة النتيجة
        Navigator.pop(context); // للتبسيط حالياً نعود للوبي
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Color _getButtonColor(String option) {
    if (!_isRoundOver) {
      if (_selectedAnswer == option) return AppTheme.brushedGold;
      return AppTheme.darkNavy;
    } else {
      final currentQ = _questions[_currentQuestionIndex];
      if (option == currentQ.correctAnswer) {
        return Colors.green.shade700;
      } else if (option == _selectedAnswer) {
        return Colors.red.shade700;
      }
      return AppTheme.darkNavy;
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentQ = _questions[_currentQuestionIndex];

    return Scaffold(
      appBar: AppBar(
        title: const Text('جولة السيطرة', style: TextStyle(color: AppTheme.brushedGold)),
        backgroundColor: AppTheme.deepBlack,
        iconTheme: const IconThemeData(color: AppTheme.brushedGold),
        centerTitle: true,
      ),
      body: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [AppTheme.deepBlack, AppTheme.darkNavy],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Timer and Round Info
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'السؤال ${_currentQuestionIndex + 1} / ${_questions.length}',
                    style: const TextStyle(color: AppTheme.mutedText, fontSize: 16),
                  ),
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      CircularProgressIndicator(
                        value: _secondsLeft / 15,
                        backgroundColor: AppTheme.deepBlack,
                        color: _secondsLeft <= 5 ? Colors.red : AppTheme.warmAmber,
                      ),
                      Text(
                        '$_secondsLeft',
                        style: TextStyle(
                          fontSize: 18, 
                          fontWeight: FontWeight.bold,
                          color: _secondsLeft <= 5 ? Colors.red : AppTheme.textWhite,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const Spacer(),
              
              // Question Card
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppTheme.deepBlack.withOpacity(0.5),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.brushedGold.withOpacity(0.3)),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.brushedGold.withOpacity(0.1),
                      blurRadius: 20,
                      spreadRadius: 2,
                    )
                  ],
                ),
                child: Text(
                  currentQ.text,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, height: 1.5),
                ),
              ),
              
              const Spacer(),
              
              // Options
              ...currentQ.options.map((option) => Padding(
                    padding: const EdgeInsets.only(bottom: 12.0),
                    child: ElevatedButton(
                      onPressed: () => _lockAnswer(option),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _getButtonColor(option),
                        foregroundColor: _selectedAnswer == option && !_isRoundOver ? AppTheme.deepBlack : AppTheme.textWhite,
                        padding: const EdgeInsets.symmetric(vertical: 18),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(
                            color: _selectedAnswer == option ? AppTheme.brushedGold : Colors.transparent,
                            width: 2,
                          ),
                        ),
                      ),
                      child: Text(
                        option,
                        style: const TextStyle(fontSize: 18),
                      ),
                    ),
                  )),
                  
              const SizedBox(height: 20),
              
              if (_isAnswerLocked && !_isRoundOver)
                const Center(
                  child: Text(
                    'تم قفل الإجابة.. ننتظر انتهاء الوقت',
                    style: TextStyle(color: AppTheme.mutedText, fontStyle: FontStyle.italic),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
